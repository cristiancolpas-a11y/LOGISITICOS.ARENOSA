import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Users, ChevronLeft, LogIn, Search, Plus, MessageSquare, 
  CheckCircle2, Clock, Calendar, Send, Paperclip, Activity,
  ChevronRight, Circle, Bell, Camera, Image as ImageIcon, Upload,
  AlertCircle, FileText, Trash2, ChevronDown, Layout, RefreshCw,
  User as UserIcon, Heart
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, query, where, getDocs, doc, getDoc, setDoc,
  addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, orderBy,
  writeBatch, arrayUnion, limit
} from 'firebase/firestore';
import { fetchPeopleUsersFromSheet, fetchMentorshipPlansFromSheet, fetchMentorshipTasksFromSheet, submitMentorshipPlanUpdateToSheet, submitMentorshipTaskEvidenceToSheet } from '../services/sheetService';
import { PeopleUser, MentorshipPlan, MentorshipTask } from '../types';

interface PeopleModuleProps {
  onBack: () => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const PeopleModule: React.FC<PeopleModuleProps> = ({ onBack }) => {
  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // If it's an index error, it usually contains a link to create it
    if (errInfo.error.includes('index')) {
      alert("Falta un índice en la base de datos. Por favor, revisa la consola para el enlace de creación.");
    }
  };

  const [activeSection, setActiveSection] = useState<'menu' | 'plan-padrino'>('menu');
  const [user, setUser] = useState<any>(null);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  
  const [tasks, setTasks] = useState<MentorshipTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState<string | null>(null);

  const handleSyncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const fetchedPlans = await fetchMentorshipPlansFromSheet();
      setPlans(fetchedPlans);
      if (activePlan) {
        const updatedActivePlan = fetchedPlans.find(p => p.id === activePlan.id);
        if (updatedActivePlan) {
          setActivePlan(updatedActivePlan);
          const fetchedTasks = await fetchMentorshipTasksFromSheet(updatedActivePlan.planIdBase || updatedActivePlan.id);
          setTasks(fetchedTasks);
        }
      }
      alert('✅ Datos sincronizados con éxito desde Google Sheets');
    } catch (error) {
      console.error('Error syncing data:', error);
      alert('❌ Error al sincronizar datos');
    } finally {
      setIsSyncing(false);
    }
  };
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastNotificationTime, setLastNotificationTime] = useState(Date.now());
  const [expandedSubniveles, setExpandedSubniveles] = useState<Record<string, boolean>>({});
  const [allMentorshipTasks, setAllMentorshipTasks] = useState<MentorshipTask[]>([]);
  const [taskPendingUpload, setTaskPendingUpload] = useState<{taskId: string, file: File} | null>(null);
  const [selectedEvidenceDate, setSelectedEvidenceDate] = useState(new Date().toISOString().split('T')[0]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.warn("Could not play notification sound", e);
    }
  };

  const showBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = loginCode.trim();
    if (!code) return;
    
    setIsLoading(true);
    setLoginError('');
    
    try {
      // 0. Check for Master Code
      if (code === '2026') {
        setUser({
          id: 'master_admin',
          name: 'Administrador Master',
          identification: 'MASTER',
          role: 'admin',
          area: 'DIRECCIÓN',
          isMaster: true
        });
        setIsLoading(false);
        return;
      }

      const codeLower = code.toLowerCase();
      // Ensure we are authenticated anonymously before proceeding
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 1. Fetch plans to check for codes
      const sheetPlans = await fetchMentorshipPlansFromSheet();
      console.log("Planes cargados:", sheetPlans.length);
      
      let foundIdentification = '';
      let foundRole: 'padrino' | 'apadrinado' | 'admin' = 'apadrinado';
      
      const planAsPadrino = sheetPlans.find(p => p.padrinoCode?.trim().toLowerCase() === codeLower);
      const planAsApadrinado = sheetPlans.find(p => p.apadrinadoCode?.trim().toLowerCase() === codeLower);
      
      if (planAsPadrino) {
        foundIdentification = planAsPadrino.padrinoId;
        foundRole = 'padrino';
      } else if (planAsApadrinado) {
        foundIdentification = planAsApadrinado.apadrinadoId;
        foundRole = 'apadrinado';
      }
      
      // 2. If not found in plans, check in People sheet (for Admins or others)
      let foundName = '';
      let foundArea = 'GENERAL';
      
      const sheetUsers = await fetchPeopleUsersFromSheet();
      console.log("Usuarios base cargados:", sheetUsers.length);
      
      const userFromSheet = sheetUsers.find(u => 
        (foundIdentification && u.identification === foundIdentification) || 
        (!foundIdentification && u.accessCode.trim().toLowerCase() === codeLower)
      );

      if (userFromSheet) {
        foundIdentification = userFromSheet.identification;
        foundName = userFromSheet.name;
        foundArea = userFromSheet.area || 'GENERAL';
        if (!planAsPadrino && !planAsApadrinado) {
          foundRole = userFromSheet.role as any || 'apadrinado';
        }
      } else if (!foundIdentification) {
        setLoginError('Código inválido. Por favor, verifique su hoja de cálculo.');
        setIsLoading(false);
        return;
      } else {
        foundName = `Usuario ${foundIdentification}`;
      }
      
      // 3. Sync with Firestore
      const usersRef = collection(db, 'people_users');
      const q = query(usersRef, where('identification', '==', foundIdentification));
      const querySnapshot = await getDocs(q);
      
      console.log("Sincronizando con Firestore para ID:", foundIdentification);
      
      let finalUser;
      if (querySnapshot.empty) {
        const newUser = {
          identification: foundIdentification,
          name: foundName,
          role: foundRole,
          area: foundArea,
          createdAt: new Date().toISOString()
        };
        console.log("Creando nuevo usuario en Firestore:", newUser);
        const docRef = await addDoc(usersRef, newUser);
        finalUser = { id: docRef.id, ...newUser };
      } else {
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();
        
        console.log("Usuario existente encontrado en Firestore:", existingDoc.id);
        
        if (existingData.role !== foundRole || existingData.name !== foundName || existingData.area !== foundArea) {
          console.log("Actualizando datos de usuario...");
          await updateDoc(doc(db, 'people_users', existingDoc.id), {
            role: foundRole,
            name: foundName,
            area: foundArea
          });
        }
        
        finalUser = { 
          id: existingDoc.id, 
          ...existingData, 
          role: foundRole, 
          name: foundName, 
          area: foundArea 
        };
      }
      
      setUser(finalUser);
    } catch (error: any) {
      console.error("Login error detail:", error);
      if (error.code === 'permission-denied') {
        setLoginError('Error de permisos en la base de datos.');
      } else {
        setLoginError('Error al conectar con el servidor o las hojas.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadPlans = async () => {
      try {
        const sheetPlans = await fetchMentorshipPlansFromSheet();
        console.log("Todos los planes de la hoja:", sheetPlans);
        
        let userPlans = [];
        if (user.role === 'admin') {
          userPlans = sheetPlans;
        } else {
          userPlans = sheetPlans.filter(p => 
            p.padrinoId === user.identification || p.apadrinadoId === user.identification
          );
        }
        console.log("Planes para mostrar:", userPlans);

        // Fetch user names for the plans
        const sheetUsers = await fetchPeopleUsersFromSheet();
        
        const enrichedPlans = userPlans.map(plan => {
          const isPadrino = user.identification === plan.padrinoId;
          const otherId = isPadrino ? plan.apadrinadoId : plan.padrinoId;
          
          // For admins, we might want to show both names or just the apadrinado
          const apadrinadoUser = sheetUsers.find(u => u.identification.trim() === plan.apadrinadoId.trim());
          const padrinoUser = sheetUsers.find(u => u.identification.trim() === plan.padrinoId.trim());
          
          return {
            ...plan,
            padrinoName: padrinoUser?.name || `ID: ${plan.padrinoId}`,
            apadrinadoName: apadrinadoUser?.name || `ID: ${plan.apadrinadoId}`,
            otherUser: user.role === 'admin' 
              ? { name: apadrinadoUser?.name || plan.apadrinadoId, area: apadrinadoUser?.area || 'Operaciones' }
              : (isPadrino 
                  ? { name: apadrinadoUser?.name || plan.apadrinadoId, area: apadrinadoUser?.area || 'Operaciones' }
                  : { name: padrinoUser?.name || plan.padrinoId, area: padrinoUser?.area || 'Operaciones' }
                )
          };
        });

        setPlans(enrichedPlans);

        // If apadrinado has exactly one active plan, enter directly
        if (user.role === 'apadrinado' && enrichedPlans.length === 1 && enrichedPlans[0].status === 'Activo') {
          setActivePlan(enrichedPlans[0]);
        }
      } catch (error) {
        console.error("Error loading plans:", error);
      }
    };

    loadPlans();
    const interval = setInterval(loadPlans, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user || plans.length === 0) return;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const msgsRef = collection(db, 'mentorship_messages');
    const planIds = plans.map(p => p.id);
    
    // Firestore 'in' query limit is 30.
    const q = query(
      msgsRef, 
      where('planId', 'in', planIds.slice(0, 30)),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      let hasNewUnread = false;
      let latestMsg: any = null;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.readBy.includes(user.id)) {
          counts[data.planId] = (counts[data.planId] || 0) + 1;
          
          const msgTime = new Date(data.createdAt).getTime();
          if (msgTime > lastNotificationTime && data.senderId !== user.id) {
            hasNewUnread = true;
            latestMsg = data;
          }
        }
      });

      if (hasNewUnread && latestMsg) {
        // Only notify if we are not looking at the plan or window is blurred
        if (!activePlan || activePlan.id !== latestMsg.planId || document.hidden) {
          playNotificationSound();
          const plan = plans.find(p => p.id === latestMsg.planId);
          const senderName = plan ? (user.role === 'admin' ? plan.apadrinadoName : plan.otherUser?.name) : 'Alguien';
          showBrowserNotification(`Nuevo mensaje de ${senderName}`, latestMsg.text);
        }
        setLastNotificationTime(Date.now());
      }

      setUnreadCounts(counts);
    });

    return () => unsubscribe();
  }, [user, plans, activePlan, lastNotificationTime]);

  useEffect(() => {
    if (!activePlan || !user) return;

    const loadTasksFromSheet = async () => {
      setIsLoadingTasks(true);
      try {
        const allTasks = await fetchMentorshipTasksFromSheet();
        setAllMentorshipTasks(allTasks);
        
        // Filter tasks related to this plan by ID_Base
        const planTasks = allTasks.filter(t => t.idBase === activePlan.planIdBase);
        
        // Merge with Firestore state (completion and evidence)
        const tasksRef = collection(db, 'mentorship_tasks');
        const qTasks = query(tasksRef, where('planId', '==', activePlan.id));
        const snapshot = await getDocs(qTasks);
        const firestoreTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const mergedTasks = planTasks.map(sheetTask => {
          const fsTask = firestoreTasks.find((ft: any) => ft.sheetTaskId === sheetTask.id) as any;
          
          // Prioritize sheet data. If sheet has evidence, use it.
          // If sheet is empty, we don't show Firestore evidence to ensure sync with sheet.
          const hasSheetEvidence = sheetTask.evidencia && sheetTask.evidencia.trim() !== '';
          
          return {
            ...sheetTask,
            isCompleted: sheetTask.estado === 'COMPLETADO',
            evidenceUrl: hasSheetEvidence ? sheetTask.evidencia : '',
            evidenceName: hasSheetEvidence ? (fsTask?.evidenceName || 'Evidencia') : '',
            evidenceType: hasSheetEvidence ? (fsTask?.evidenceType || 'image/jpeg') : '',
            uploadedAt: hasSheetEvidence ? (fsTask?.uploadedAt || '') : ''
          };
        });

        setTasks(mergedTasks);
      } catch (error) {
        console.error("Error loading tasks from sheet:", error);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasksFromSheet();

    const msgsRef = collection(db, 'mentorship_messages');
    // Simplified query to avoid composite index requirement for now
    const qMsgs = query(msgsRef, where('planId', '==', activePlan.id));
    const unsubMsgs = onSnapshot(qMsgs, (snapshot) => {
      const newMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      newMsgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(newMsgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'mentorship_messages');
    });

    return () => {
      unsubMsgs();
    };
  }, [activePlan]);

  useEffect(() => {
    if (isChatOpen && activePlan && messages.length > 0 && user) {
      messages.forEach(msg => {
        if (!msg.readBy.includes(user.id)) {
          updateDoc(doc(db, 'mentorship_messages', msg.id), {
            readBy: arrayUnion(user.id)
          });
        }
      });
    }
  }, [isChatOpen, activePlan, messages, user?.id]);

  const renderTaskItem = (task: MentorshipTask) => (
    <div 
      key={task.id} 
      className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
        task.isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#2C394B] border-[#334756] hover:border-[#FF4C29]/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <button 
          onClick={() => handleToggleTask(task)}
          disabled={(user.role !== 'padrino' && user.role !== 'admin') || user.isMaster}
          className={`transition-colors ${
            task.isCompleted ? 'text-emerald-500' : 'text-slate-500 hover:text-[#FF4C29]'
          } ${((user.role !== 'padrino' && user.role !== 'admin') || user.isMaster) ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {task.isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div className="flex-grow flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold leading-tight ${task.isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
              {task.tarea}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] font-black text-[#FF4C29] uppercase tracking-widest">{task.pilar}</span>
              {task.matriz && (
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">• {task.matriz}</span>
              )}
            </div>
          </div>
          
          {task.evidenceUrl ? (
            <div className="flex items-center gap-3 bg-[#082032] px-3 py-1.5 rounded-lg border border-[#334756]">
              <div className="flex items-center gap-2">
                {task.evidenceType?.startsWith('image/') ? (
                  <ImageIcon size={12} className="text-[#FF4C29] shrink-0" />
                ) : (
                  <FileText size={12} className="text-[#FF4C29] shrink-0" />
                )}
                <span className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">{task.evidenceName || 'Evidencia'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.open(task.evidenceUrl, '_blank')}
                  className="text-[8px] font-black text-[#FF4C29] uppercase hover:underline"
                >
                  Ver
                </button>
                {(!task.isCompleted) && (
                  isUploadingEvidence === task.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#FF4C29]"></div>
                  ) : (
                    <label className="cursor-pointer">
                      <Camera size={12} className="text-slate-500 hover:text-[#FF4C29]" />
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => handleUploadEvidence(task.id, e)}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                    </label>
                  )
                )}
              </div>
            </div>
          ) : (
            isUploadingEvidence === task.id ? (
              <div className="flex items-center justify-center gap-2 py-2 border border-dashed border-[#FF4C29]/50 bg-[#FF4C29]/5 rounded-xl">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#FF4C29]"></div>
                <span className="text-[9px] font-black text-[#FF4C29] uppercase tracking-widest">Subiendo...</span>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 py-2 border border-dashed border-[#334756] rounded-xl cursor-pointer hover:border-[#FF4C29]/50 hover:bg-[#FF4C29]/5 transition-all group">
                <Camera size={14} className="text-slate-500 group-hover:text-[#FF4C29]" />
                <span className="text-[9px] font-black text-slate-500 group-hover:text-[#FF4C29] uppercase tracking-widest">Subir Evidencia</span>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => handleUploadEvidence(task.id, e)}
                  accept="image/*,.pdf,.doc,.docx"
                />
              </label>
            )
          )}
        </div>
      </div>
    </div>
  );

  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const text = newMessage.trim();
    if (!text || !activePlan || user.isMaster) return;

    // Clear state immediately and don't look back
    setNewMessage('');

    try {
      // 1. Add the message
      await addDoc(collection(db, 'mentorship_messages'), {
        planId: activePlan.id,
        senderId: user.id,
        text: text,
        attachments: [],
        readBy: [user.id],
        createdAt: new Date().toISOString()
      });
      
      // 2. Update plan activity
      try {
        await setDoc(doc(db, 'mentorship_plans', activePlan.id), {
          lastActivityAt: new Date().toISOString(),
          planId: activePlan.id
        }, { merge: true });
      } catch (planErr) {
        console.warn("Non-critical: Could not update plan activity timestamp", planErr);
      }
    } catch (error) {
      console.error("Critical: Error sending message:", error);
      // Only restore if the message definitely wasn't sent
      // and only if the current input is still empty
      setNewMessage(prev => prev === '' ? text : prev); 
    }
  };

  const handleClearChat = async () => {
    if (user.role !== 'admin' || !activePlan || user.isMaster) return;
    
    console.log("Iniciando limpieza de chat para plan:", activePlan.id);
    try {
      const msgsRef = collection(db, 'mentorship_messages');
      const q = query(msgsRef, where('planId', '==', activePlan.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log("No se encontraron mensajes para borrar.");
        setShowConfirmClear(false);
        return;
      }

      console.log(`Borrando ${snapshot.size} mensajes...`);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log("Chat limpiado con éxito.");
      setShowConfirmClear(false);
    } catch (error) {
      console.error("Error al limpiar el chat:", error);
      alert("Hubo un error al limpiar el chat. Revisa la consola.");
    }
  };

  const handleDeleteDuplicateTasks = async () => {
    if (user.role !== 'admin' || !activePlan || user.isMaster) return;
    
    try {
      const tasksRef = collection(db, 'mentorship_tasks');
      const q = query(tasksRef, where('planId', '==', activePlan.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const seen = new Set();
      const batch = writeBatch(db);
      let deletedCount = 0;
      let updatedCount = 0;

      // Sort by createdAt to keep the oldest one
      const sortedDocs = [...snapshot.docs].sort((a, b) => {
        const timeA = new Date(a.data().createdAt || 0).getTime();
        const timeB = new Date(b.data().createdAt || 0).getTime();
        return timeA - timeB;
      });

      sortedDocs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.description.trim()}-${data.pilar}-${data.matriz || ''}`;
        
        if (seen.has(key)) {
          batch.delete(doc.ref);
          deletedCount++;
        } else {
          seen.add(key);
        }
      });

      if (deletedCount > 0 || updatedCount > 0) {
        await batch.commit();
        alert(`Se eliminaron ${deletedCount} tareas duplicadas y se actualizaron ${updatedCount} tareas.`);
      } else {
        alert("No se encontraron tareas duplicadas exactas.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'mentorship_tasks (delete duplicates)');
      alert("Error al eliminar duplicados.");
    }
  };

  const handleToggleTask = async (task: MentorshipTask) => {
    if ((user.role !== 'padrino' && user.role !== 'admin') || user.isMaster) return; // Only padrino or admin can validate tasks
    
    if (task.evidencia && !task.evidenceUrl && !task.isCompleted) {
      alert("Esta tarea requiere evidencias (fotos/documentos) antes de ser marcada como completada.");
      return;
    }

    try {
      const isCompleted = !task.isCompleted;
      
      // Find or create Firestore doc for this task
      const tasksRef = collection(db, 'mentorship_tasks');
      const q = query(tasksRef, where('planId', '==', activePlan.id), where('sheetTaskId', '==', task.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        await addDoc(tasksRef, {
          planId: activePlan.id,
          sheetTaskId: task.id,
          description: task.tarea,
          isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null,
          createdAt: new Date().toISOString()
        });
      } else {
        await updateDoc(doc(db, 'mentorship_tasks', snapshot.docs[0].id), {
          isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : null
        });
      }

      // Recalculate progress
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, isCompleted } : t);
      const completedCount = updatedTasks.filter(t => t.isCompleted).length;
      const progress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;

      await updateDoc(doc(db, 'mentorship_plans', activePlan.id), {
        progress,
        lastActivityAt: new Date().toISOString()
      });

      // Update Sheet
      await submitMentorshipPlanUpdateToSheet({
        id: activePlan.id,
        progress: progress
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'mentorship_tasks (toggle)');
    }
  };

  const compressImage = (base64Str: string, watermarkText?: string, maxWidth = 1200, maxHeight = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        if (watermarkText) {
          const fontSize = Math.max(14, Math.floor(width / 25));
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          
          // Background for text readability
          const textWidth = ctx.measureText(watermarkText).width;
          const padding = fontSize / 2;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(width - textWidth - padding * 3, height - fontSize - padding * 2.5, textWidth + padding * 2, fontSize + padding * 1.5);

          ctx.fillStyle = 'white';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          
          ctx.fillText(watermarkText, width - padding * 2, height - padding * 2);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const processAndUploadEvidence = async (taskId: string, file: File, date: string) => {
    setIsUploadingEvidence(taskId);
    const reader = new FileReader();
    reader.onload = async (event) => {
      let base64 = event.target?.result as string;
      
      // Compress and add watermark if it's an image
      if (file.type.startsWith('image/')) {
        const watermark = `FECHA: ${date} | ${activePlan?.apadrinadoName || ''}`;
        base64 = await compressImage(base64, watermark);
      }

      try {
        const evidenceData = {
          evidenceUrl: base64,
          evidenceName: file.name,
          evidenceType: file.type,
          uploadedAt: new Date().toISOString(),
          evidenceDate: date
        };

        // Find or create Firestore doc for this task
        const tasksRef = collection(db, 'mentorship_tasks');
        // Simplified query to avoid composite index requirement
        const q = query(tasksRef, where('planId', '==', activePlan.id));
        const snapshot = await getDocs(q);
        
        const task = tasks.find(t => t.id === taskId);
        const existingDoc = snapshot.docs.find(d => d.data().sheetTaskId === taskId);

        const taskDocRef = existingDoc 
          ? doc(db, 'mentorship_tasks', existingDoc.id)
          : doc(tasksRef); // Auto-generate ID if not exists

        const finalData = {
          planId: activePlan.id,
          sheetTaskId: taskId,
          description: task?.tarea || 'Tarea desconocida',
          pilar: task?.pilar || '',
          matriz: task?.matriz || '',
          subnivel: task?.subnivel || '',
          ...evidenceData,
          isCompleted: task?.estado === 'COMPLETADO' || false,
          updatedAt: new Date().toISOString()
        };

        if (!existingDoc) {
          (finalData as any).createdAt = new Date().toISOString();
        }

        // Use setDoc with merge: true to avoid "No document to update" errors
        await setDoc(taskDocRef, finalData, { merge: true });

        // Also submit to Google Sheet
        const success = await submitMentorshipTaskEvidenceToSheet({
          planId: activePlan.planIdBase || activePlan.id,
          taskId: taskId,
          taskDescription: task?.tarea || 'Tarea desconocida',
          pilar: task?.pilar || '',
          matriz: task?.matriz || '',
          subnivel: task?.subnivel || '',
          padrinoName: activePlan.padrinoName,
          apadrinadoName: activePlan.apadrinadoName,
          ...evidenceData
        });

        if (success) {
          alert("✅ Evidencia subida con éxito a la hoja de cálculo.");
        } else {
          alert("⚠️ La evidencia se guardó en el sistema, pero no se pudo sincronizar con Excel. Por favor, revisa la hoja LOGS en tu Google Sheets.");
        }

      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'mentorship_tasks (evidence)');
        alert("❌ Error crítico al procesar la evidencia: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsUploadingEvidence(null);
        setTaskPendingUpload(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadEvidence = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePlan) return;
    
    // If it's an image, we need a date for the watermark
    if (file.type.startsWith('image/')) {
      setTaskPendingUpload({ taskId, file });
    } else {
      // For other files, upload directly with current date
      processAndUploadEvidence(taskId, file, new Date().toISOString().split('T')[0]);
    }
  };

  const handleUpdateStartDate = async (date: string) => {
    if (!activePlan || (user.role !== 'padrino' && user.role !== 'admin')) return;
    try {
      // Calculate end date (7 days after start)
      const startDateObj = new Date(date);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + 7);
      const endDateStr = endDateObj.toISOString().split('T')[0];

      await updateDoc(doc(db, 'mentorship_plans', activePlan.id), {
        startDate: date,
        endDate: endDateStr,
        lastActivityAt: new Date().toISOString()
      });
      
      await submitMentorshipPlanUpdateToSheet({
        id: activePlan.id,
        startDate: date,
        endDate: endDateStr
      });
      
      setActivePlan({ ...activePlan, startDate: date, endDate: endDateStr });
    } catch (error) {
      console.error("Error updating start date:", error);
    }
  };

  if (activeSection === 'menu') {
    return (
      <div className="flex flex-col h-full w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Existing Content */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-orange-500/10 rounded-[2rem] flex items-center justify-center text-orange-600 shadow-inner">
              <Users size={36} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">People</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestión y Mentoría de Personal</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="p-4 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* PLAN PADRINO BUTTON */}
          <button 
            onClick={() => setActiveSection('plan-padrino')}
            className="group relative bg-[#0a1121] hover:bg-white/[0.03] border-2 border-orange-500/40 p-10 rounded-[3rem] transition-all flex flex-col items-start gap-8 text-left active:scale-[0.98] shadow-3xl shadow-black/80 overflow-hidden h-full"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/15 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
            
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xl relative z-10 overflow-hidden p-3">
              <img 
                src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
                alt="People Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,76,41,0.5)]"
              />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-4">Plan Padrino</h3>
              <p className="text-xs font-medium text-slate-400 leading-relaxed text-pretty">
                Programa estratégico de mentoría y acompañamiento para el desarrollo acelerado de nuestros colaboradores.
              </p>
            </div>
            
            <div className="mt-auto text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 flex items-center gap-2 group-hover:translate-x-2 transition-transform relative z-10 pt-4">
              Ingresar Ahora <ChevronRight size={14} />
            </div>
          </button>

          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center opacity-60 hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-6 border border-slate-100">
              <Activity size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-tight mb-2">Próximamente</h3>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Nuevos módulos de gestión de talento<br/>en desarrollo</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto p-6">
        <div className="w-24 h-24 bg-[#2C394B] rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl border border-[#334756] overflow-hidden p-3 relative">
          <img 
            src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
            alt="People Logo" 
            className="w-full h-full object-contain relative z-10"
          />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2 text-center">Acceso People</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center mb-8">
          Ingrese su código único para continuar
        </p>
        
        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <input
              type="text"
              placeholder="CÓDIGO DE ACCESO"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="w-full bg-[#2C394B] border-2 border-[#334756] text-white rounded-2xl px-6 py-4 text-center text-xl font-black uppercase tracking-widest outline-none focus:border-[#FF4C29] focus:ring-4 focus:ring-[#FF4C29]/20 transition-all"
            />
          </div>
          {loginError && (
            <p className="text-[#FF4C29] text-xs font-bold text-center uppercase">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#FF4C29] hover:bg-[#FF4C29]/80 text-white rounded-2xl px-6 py-4 font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#FF4C29]/30 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : <><LogIn size={20} /> Ingresar</>}
          </button>
        </form>
        
        <button 
          onClick={() => setActiveSection('menu')}
          className="mt-8 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
        >
          <ChevronLeft size={16} /> Volver a People
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#082032] w-full">
      <div className="flex items-center justify-between mb-4 md:mb-8 bg-[#2C394B] p-4 md:p-6 rounded-2xl md:rounded-3xl border border-[#334756] shadow-xl shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#334756] rounded-lg md:rounded-xl flex items-center justify-center border border-[#334756] overflow-hidden shadow-sm p-1 relative">
            <img 
              src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
              alt="People Logo" 
              className="w-full h-full object-contain relative z-10"
            />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">Plan Padrino</h2>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
              {user.name} • {user.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setUser(null)}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-[#334756] text-white rounded-lg md:rounded-xl font-black uppercase tracking-widest text-[8px] md:text-[10px] hover:bg-[#FF4C29] transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <div className="flex-grow bg-[#2C394B] rounded-2xl md:rounded-3xl border border-[#334756] shadow-xl overflow-hidden flex flex-col">
        {!activePlan ? (
          <div className="p-4 md:p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div>
                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                  {user.role === 'admin' ? 'Panel de Control Master' : 'Mis Planes de Mentoría'}
                </h3>
                <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
                  {user.role === 'admin' ? 'Seguimiento global de todos los procesos' : (user.role === 'padrino' ? 'Colaboradores a tu cargo' : 'Tu proceso de formación')}
                </p>
              </div>
              {user.role === 'admin' && (
                <button className="px-3 py-1.5 md:px-4 md:py-2 bg-[#FF4C29] text-white rounded-lg md:rounded-xl font-black uppercase tracking-widest text-[8px] md:text-[10px] hover:bg-[#FF4C29]/80 transition-all flex items-center gap-1 md:gap-2">
                  <Plus size={14} md:size={16} /> Nuevo Plan
                </button>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-12 md:py-20">
                <Users size={40} md:size={48} className="text-[#334756] mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">No tienes planes activos en este momento</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {plans.map((plan, index) => (
                  <div 
                    key={`${plan.id}-${index}`}
                    onClick={() => setActivePlan(plan)}
                    className="border-2 border-[#334756] bg-[#082032]/50 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-[#FF4C29] hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${
                          plan.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-400' :
                          plan.status === 'En proceso' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-[#334756] text-slate-400'
                        }`}>
                          {plan.status}
                        </span>
                        {unreadCounts[plan.id] > 0 && (
                          <span className="bg-[#FF4C29] text-white text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                            <Bell size={8} fill="currentColor" /> {unreadCounts[plan.id]}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[8px] md:text-[10px] font-bold flex items-center gap-1">
                        <Calendar size={10} md:size={12} /> {plan.endDate}
                      </span>
                    </div>
                    
                    <div className="mb-4 md:mb-6">
                      <h4 className="text-base md:text-lg font-black text-white uppercase leading-tight group-hover:text-[#FF4C29] transition-colors">
                        {user.role === 'admin' ? plan.apadrinadoName : (plan.otherUser?.name || 'Usuario Desconocido')}
                      </h4>
                      <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
                        {user.role === 'admin' 
                          ? `Padrino: ${plan.padrinoName}` 
                          : `${user.role === 'padrino' ? 'Apadrinado' : 'Padrino'} • ${plan.otherUser?.area || 'Sin área'}`
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5 md:space-y-2">
                      <div className="flex justify-between text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Avance</span>
                        <span className="text-[#FF4C29]">{plan.progress}%</span>
                      </div>
                      <div className="w-full bg-[#334756] h-1.5 md:h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#FF4C29] transition-all duration-1000"
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full bg-[#082032]">
            {/* Plan Header */}
            <div className="p-4 md:p-6 border-b border-[#334756] flex flex-col sm:flex-row sm:items-center justify-between shrink-0 bg-[#2C394B] gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <button 
                  onClick={() => setActivePlan(null)}
                  className="p-1.5 md:p-2 hover:bg-[#334756] rounded-lg md:rounded-xl transition-colors text-slate-400"
                >
                  <ChevronLeft size={20} md:size={24} />
                </button>
                <div>
                  <h3 className="text-base md:text-xl font-black text-white uppercase tracking-tight">
                    {user.role === 'admin' ? `${activePlan.apadrinadoName} (Apadrinado)` : (activePlan.otherUser?.name || 'Usuario Desconocido')}
                  </h3>
                  <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">
                    {user.role === 'admin' ? `Padrino: ${activePlan.padrinoName}` : 'Plan de Formación • ' + activePlan.status}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4 self-end sm:self-auto">
                <button
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all ${
                    isSyncing 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                </button>
                <div className="text-right">
                  <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso</div>
                  <div className="text-lg md:text-xl font-black text-[#FF4C29]">{activePlan.progress}%</div>
                </div>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="relative p-2 md:p-3 bg-[#FF4C29] text-white rounded-lg md:rounded-xl hover:bg-[#FF4C29]/80 transition-all shadow-lg shadow-[#FF4C29]/20"
                >
                  <MessageSquare size={18} md:size={20} />
                  {unreadCounts[activePlan.id] > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-white text-[#FF4C29] text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#FF4C29] animate-bounce">
                      {unreadCounts[activePlan.id]}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Plan Content */}
            <div className="flex-grow flex flex-col overflow-hidden relative">
              {/* Collapsible Details & Progress */}
              <div className="shrink-0 bg-[#082032] border-b border-[#334756]">
                <button 
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full px-6 py-3 flex items-center justify-between text-slate-500 hover:text-white transition-colors"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    {showDetails ? 'Ocultar Detalles del Plan' : 'Ver Detalles y Progreso'}
                  </span>
                  {showDetails ? <ChevronLeft className="rotate-90" size={16} /> : <ChevronLeft className="-rotate-90" size={16} />}
                </button>
                
                {showDetails && (
                  <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top duration-300">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Calendar size={14} className="text-[#FF4C29]" /> Cronograma
                      </h4>
                      <div className="bg-[#2C394B] rounded-2xl p-4 space-y-3 border border-[#334756]">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inicio</span>
                          {activePlan.startDate ? (
                            <span className="text-xs font-bold text-slate-300">{activePlan.startDate}</span>
                          ) : (user.role === 'padrino' || user.role === 'admin') ? (
                            <input 
                              type="date" 
                              onChange={(e) => handleUpdateStartDate(e.target.value)}
                              className="text-[10px] bg-[#334756] border border-[#334756] text-white rounded-lg px-2 py-1 outline-none focus:border-[#FF4C29]"
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-500 italic">Pendiente</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fin</span>
                          <span className="text-xs font-bold text-slate-300">{activePlan.endDate || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#2C394B] rounded-2xl p-5 border border-[#334756] flex flex-col justify-center relative overflow-hidden">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progreso General</span>
                        <span className="text-lg font-black text-[#FF4C29]">{activePlan.progress}%</span>
                      </div>
                      <div className="h-3 bg-[#082032] rounded-full overflow-hidden border border-[#334756] p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-[#FF4C29] to-[#FF4C29]/60 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,76,41,0.3)]"
                          style={{ width: `${activePlan.progress}%` }}
                        />
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-slate-500" />
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                            {activePlan.startDate ? (
                              (() => {
                                const end = new Date(activePlan.endDate);
                                const now = new Date();
                                const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                return diff > 0 ? `${diff} días restantes` : 'Plazo cumplido';
                              })()
                            ) : 'Esperando inicio'}
                          </span>
                        </div>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                          {tasks.filter(t => t.isCompleted).length} / {tasks.length} Tareas
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks List */}
              <div className="flex-grow p-4 md:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 md:gap-8">
                <div>
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={14} md:size={16} className="text-[#FF4C29]" /> Tareas Compartidas
                      </h4>
                      <div className="flex items-center gap-4">
                        {activePlan.startDate && (
                          <div className="flex items-center gap-1.5 bg-[#FF4C29]/10 px-3 py-1 rounded-full border border-[#FF4C29]/20">
                            <Clock size={12} className="text-[#FF4C29]" />
                            <span className="text-[10px] font-black text-[#FF4C29] uppercase tracking-widest">
                              Día {Math.floor((new Date().getTime() - new Date(activePlan.startDate).getTime()) / (1000 * 60 * 60 * 24))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                  <div className="space-y-6">
                    {Object.entries(
                      tasks.reduce((acc, task) => {
                        const sub = task.subnivel || 'GENERAL';
                        if (!acc[sub]) acc[sub] = [];
                        acc[sub].push(task);
                        return acc;
                      }, {} as Record<string, MentorshipTask[]>)
                    ).map(([subnivel, subTasks]) => {
                      const typedSubTasks = subTasks as MentorshipTask[];
                      return (
                        <div key={subnivel} className="bg-[#2C394B]/50 rounded-3xl border border-[#334756] overflow-hidden">
                          <button 
                            onClick={() => setExpandedSubniveles(prev => ({ ...prev, [subnivel]: !prev[subnivel] }))}
                            className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-[#FF4C29]/5 transition-all group"
                          >
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#FF4C29]/10 flex items-center justify-center text-[#FF4C29] group-hover:scale-110 transition-transform shrink-0">
                                <Layout size={20} md:size={24} />
                              </div>
                              <div className="text-left overflow-hidden">
                                <h5 className="text-xs md:text-sm font-black text-white uppercase tracking-widest truncate">{subnivel}</h5>
                                <div className="flex items-center gap-2 md:gap-3 mt-1">
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 size={8} md:size={10} className="text-emerald-500" />
                                    <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {typedSubTasks.filter(t => t.isCompleted).length} / {typedSubTasks.length}
                                    </span>
                                  </div>
                                  <div className="w-16 md:w-24 h-1 bg-[#082032] rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 transition-all duration-500"
                                      style={{ 
                                        width: `${Math.round((typedSubTasks.filter(t => t.isCompleted).length / Math.max(1, typedSubTasks.length)) * 100)}%` 
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className={`transition-transform duration-300 ${expandedSubniveles[subnivel] ? 'rotate-180' : ''}`}>
                              <ChevronDown size={20} className="text-slate-500" />
                            </div>
                          </button>

                          {expandedSubniveles[subnivel] && (
                            <div className="p-6 pt-0 border-t border-[#334756]/50 space-y-8">
                              {Object.entries(
                                typedSubTasks.reduce((acc, task) => {
                                  const pilar = task.pilar || 'GENERAL';
                                  if (!acc[pilar]) acc[pilar] = [];
                                  acc[pilar].push(task);
                                  return acc;
                                }, {} as Record<string, MentorshipTask[]>)
                              ).map(([pilar, pilarTasks]) => {
                                const typedPilarTasks = pilarTasks as MentorshipTask[];
                                return (
                                  <div key={pilar} className="mt-6 first:mt-4 space-y-4">
                                    <h6 className="text-[10px] font-black text-[#FF4C29] uppercase tracking-[0.2em] border-l-2 border-[#FF4C29] pl-2 py-0.5">
                                      {pilar}
                                    </h6>
                                    <div className="flex flex-col gap-2">
                                      {typedPilarTasks.map(task => renderTaskItem(task))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {tasks.length === 0 && (
                      <div className="text-center py-20 bg-[#2C394B]/30 rounded-[40px] border-2 border-dashed border-[#334756] flex flex-col items-center">
                        <Clock size={48} className="text-[#334756] mb-4" />
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-6">No hay tareas asignadas aún</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Floating Chat Button */}
              <div className="fixed bottom-8 right-8 z-50">
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="w-16 h-16 bg-[#FF4C29] text-white rounded-full shadow-2xl shadow-[#FF4C29]/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all relative group"
                >
                  <span className="text-2xl group-hover:rotate-12 transition-transform">💬</span>
                  {unreadCounts[activePlan.id] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-[#FF4C29] text-[10px] font-black px-2 py-1 rounded-full border-2 border-[#FF4C29] animate-bounce">
                      {unreadCounts[activePlan.id]}
                    </span>
                  )}
                </button>
              </div>

              {/* Chat Overlay/Modal */}
              {isChatOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-[#082032]/80 backdrop-blur-sm">
                  <div className="w-full max-w-2xl h-full max-h-[800px] bg-[#082032] border border-[#334756] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                    <div className="p-6 border-b border-[#334756] bg-[#2C394B] shrink-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FF4C29]/10 rounded-xl flex items-center justify-center border border-[#FF4C29]/20">
                          <MessageSquare size={20} className="text-[#FF4C29]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">Chat del Plan</h4>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Acompañamiento en tiempo real</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {(user.role === 'admin' && !user.isMaster) && (
                          <div className="flex items-center gap-2">
                            {showConfirmClear ? (
                              <div className="flex items-center gap-2 bg-rose-500/10 p-1 rounded-lg border border-rose-500/20">
                                <span className="text-[8px] font-bold text-rose-400 uppercase">¿Borrar?</span>
                                <button onClick={handleClearChat} className="text-[9px] font-black bg-rose-500 text-white px-2 py-1 rounded-md">Sí</button>
                                <button onClick={() => setShowConfirmClear(false)} className="text-[9px] font-black bg-[#334756] text-white px-2 py-1 rounded-md">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setShowConfirmClear(true)} className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/10 px-2 py-1 rounded-lg">Limpiar</button>
                            )}
                          </div>
                        )}
                        <button 
                          onClick={() => setIsChatOpen(false)}
                          className="p-2 hover:bg-[#334756] rounded-xl transition-colors text-slate-400"
                        >
                          <ChevronRight size={24} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-grow p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-[#082032]/50">
                      {messages.length === 0 ? (
                        <div className="text-center py-20">
                          <div className="w-20 h-20 bg-[#2C394B] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#334756]">
                            <MessageSquare size={32} className="text-[#334756]" />
                          </div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No hay mensajes aún</p>
                        </div>
                      ) : (
                        messages.map(msg => {
                          const isMine = msg.senderId === user.id;
                          const timeString = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={msg.id} className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                              <div className={`px-5 py-3 max-w-[85%] shadow-lg ${
                                isMine 
                                  ? 'bg-[#FF4C29] text-white rounded-[24px] rounded-tr-none' 
                                  : 'bg-[#2C394B] border border-[#334756] text-white rounded-[24px] rounded-tl-none'
                              }`}>
                                {msg.text && <p className="text-xs leading-relaxed">{msg.text}</p>}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {msg.attachments.map((url: string, i: number) => (
                                      <img 
                                        key={i} 
                                        src={url} 
                                        alt="Attachment" 
                                        className="max-w-full rounded-lg border border-white/10"
                                        referrerPolicy="no-referrer"
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-[9px] font-bold text-slate-600 uppercase px-2">{timeString}</span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-6 bg-[#2C394B] border-t border-[#334756] shrink-0">
                      {user.isMaster ? (
                        <div className="bg-[#082032] border border-[#334756] rounded-2xl p-4 text-center">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo Visualización: No puedes enviar mensajes</p>
                        </div>
                      ) : (
                        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-[#082032] border border-[#334756] rounded-[24px] p-2 focus-within:border-[#FF4C29] focus-within:ring-4 focus-within:ring-[#FF4C29]/10 transition-all">
                          <button type="button" className="p-3 text-slate-500 hover:text-[#FF4C29] transition-colors">
                            <Paperclip size={20} />
                          </button>
                          <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSendMessage(e);
                              }
                            }}
                            placeholder="Escribe un mensaje..." 
                            className="flex-grow bg-transparent text-white text-xs outline-none px-2"
                          />
                          <button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className="w-12 h-12 bg-[#FF4C29] text-white rounded-2xl flex items-center justify-center hover:bg-[#FF4C29]/80 transition-all disabled:opacity-50 shadow-lg shadow-[#FF4C29]/20"
                          >
                            <Send size={18} />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Date Selection Modal for Watermark */}
              {taskPendingUpload && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#082032]/90 backdrop-blur-md">
                  <div className="w-full max-w-md bg-[#2C394B] border border-[#334756] rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-[#FF4C29]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#FF4C29]/20 mx-auto">
                      <Calendar size={32} className="text-[#FF4C29]" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight text-center mb-2">Fecha de Evidencia</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center mb-8">
                      Selecciona la fecha para la marca de agua
                    </p>
                    
                    <div className="space-y-6">
                      <input 
                        type="date" 
                        value={selectedEvidenceDate}
                        onChange={(e) => setSelectedEvidenceDate(e.target.value)}
                        className="w-full bg-[#082032] border-2 border-[#334756] text-white rounded-2xl px-6 py-4 text-center text-lg font-black uppercase tracking-widest outline-none focus:border-[#FF4C29] transition-all"
                      />
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setTaskPendingUpload(null)}
                          className="flex-1 bg-[#334756] hover:bg-[#334756]/80 text-white rounded-2xl px-6 py-4 font-black uppercase tracking-widest text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => processAndUploadEvidence(taskPendingUpload.taskId, taskPendingUpload.file, selectedEvidenceDate)}
                          className="flex-1 bg-[#FF4C29] hover:bg-[#FF4C29]/80 text-white rounded-2xl px-6 py-4 font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-[#FF4C29]/20"
                        >
                          Subir Ahora
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeopleModule;
