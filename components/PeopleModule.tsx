import React, { useState, useEffect } from 'react';
import { 
  Users, ChevronLeft, LogIn, Search, Plus, MessageSquare, 
  CheckCircle2, Clock, Calendar, Send, Paperclip, Activity,
  ChevronRight, Circle, Bell
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, query, where, getDocs, doc, getDoc, setDoc,
  addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, orderBy,
  writeBatch, arrayUnion, limit
} from 'firebase/firestore';
import { fetchPeopleUsersFromSheet, fetchMentorshipPlansFromSheet, submitMentorshipPlanUpdateToSheet } from '../services/sheetService';
import { PeopleUser, MentorshipPlan } from '../types';

interface PeopleModuleProps {
  onBack: () => void;
}

const PeopleModule: React.FC<PeopleModuleProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<'menu' | 'plan-padrino'>('menu');
  const [user, setUser] = useState<any>(null);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastNotificationTime, setLastNotificationTime] = useState(Date.now());

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
          area: 'DIRECCIÓN'
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

    const tasksRef = collection(db, 'mentorship_tasks');
    const qTasks = query(tasksRef, where('planId', '==', activePlan.id), orderBy('createdAt', 'asc'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const msgsRef = collection(db, 'mentorship_messages');
    const qMsgs = query(msgsRef, where('planId', '==', activePlan.id), orderBy('createdAt', 'asc'));
    const unsubMsgs = onSnapshot(qMsgs, (snapshot) => {
      const newMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(newMsgs);
      
      // Mark as read
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.readBy.includes(user.id)) {
          updateDoc(doc(db, 'mentorship_messages', docSnap.id), {
            readBy: arrayUnion(user.id)
          });
        }
      });
    });

    return () => {
      unsubTasks();
      unsubMsgs();
    };
  }, [activePlan]);

  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const text = newMessage.trim();
    if (!text || !activePlan) return;

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
    if (user.role !== 'admin' || !activePlan) return;
    
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

  const handleToggleTask = async (task: any) => {
    if (user.role !== 'padrino' && user.role !== 'admin') return; // Only padrino or admin can validate tasks
    
    try {
      const isCompleted = !task.isCompleted;
      await updateDoc(doc(db, 'mentorship_tasks', task.id), {
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null
      });

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
      console.error("Error toggling task:", error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDesc.trim() || !activePlan || (user.role !== 'padrino' && user.role !== 'admin')) return;

    try {
      await addDoc(collection(db, 'mentorship_tasks'), {
        planId: activePlan.id,
        description: newTaskDesc.trim(),
        isCompleted: false,
        createdAt: new Date().toISOString()
      });
      
      setNewTaskDesc('');
      setIsAddingTask(false);
      
      // Recalculate progress
      const newTotal = tasks.length + 1;
      const completedCount = tasks.filter(t => t.isCompleted).length;
      const progress = Math.round((completedCount / newTotal) * 100);
      
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
      console.error("Error adding task:", error);
    }
  };

  const handleUpdateStartDate = async (date: string) => {
    if (!activePlan || (user.role !== 'padrino' && user.role !== 'admin')) return;
    try {
      await updateDoc(doc(db, 'mentorship_plans', activePlan.id), {
        startDate: date,
        lastActivityAt: new Date().toISOString()
      });
      
      await submitMentorshipPlanUpdateToSheet({
        id: activePlan.id,
        startDate: date
      });
      
      setActivePlan({ ...activePlan, startDate: date });
    } catch (error) {
      console.error("Error updating start date:", error);
    }
  };

  if (activeSection === 'menu') {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto p-8 bg-[#082032]">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-[#2C394B] rounded-3xl flex items-center justify-center shadow-xl border border-[#334756] overflow-hidden p-2 relative">
              <img 
                src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
                alt="People Logo" 
                className="w-full h-full object-contain relative z-10"
              />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tight">People</h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Gestión de Talento Humano</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="p-3 hover:bg-[#2C394B] rounded-2xl transition-colors text-slate-400"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button 
            onClick={() => setActiveSection('plan-padrino')}
            className="group relative bg-[#082032] border-2 border-[#334756] rounded-[40px] p-8 text-left hover:border-[#FF4C29] hover:shadow-2xl hover:shadow-[#FF4C29]/10 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4C29]/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
            
            <div className="w-16 h-16 bg-[#2C394B] rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-[#334756] overflow-hidden group-hover:scale-110 transition-transform duration-500 p-2 relative">
              <img 
                src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
                alt="People Logo" 
                className="w-full h-full object-contain relative z-10"
              />
            </div>
            
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Plan Padrino</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Programa de mentoría y acompañamiento para el desarrollo profesional de nuestros colaboradores.
            </p>
            
            <div className="mt-8 flex items-center gap-2 text-[#FF4C29] font-black uppercase tracking-widest text-[10px]">
              Ingresar ahora <ChevronRight size={14} />
            </div>
          </button>

          <div className="bg-[#2C394B]/30 border-2 border-dashed border-[#334756] rounded-[40px] p-8 flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-16 h-16 bg-[#2C394B] rounded-3xl flex items-center justify-center text-slate-500 mb-6 border border-[#334756]">
              <Activity size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-500 uppercase tracking-tight mb-2">Próximamente</h3>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nuevos módulos de gestión</p>
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
    <div className="flex flex-col h-full bg-[#082032]">
      <div className="flex items-center justify-between mb-8 bg-[#2C394B] p-6 rounded-3xl border border-[#334756] shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#334756] rounded-xl flex items-center justify-center border border-[#334756] overflow-hidden shadow-sm p-1 relative">
            <img 
              src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
              alt="People Logo" 
              className="w-full h-full object-contain relative z-10"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Plan Padrino</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {user.name} • {user.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setUser(null)}
            className="px-4 py-2 bg-[#334756] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#FF4C29] transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <div className="flex-grow bg-[#2C394B] rounded-3xl border border-[#334756] shadow-xl overflow-hidden flex flex-col">
        {!activePlan ? (
          <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {user.role === 'admin' ? 'Panel de Control Master' : 'Mis Planes de Mentoría'}
                </h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {user.role === 'admin' ? 'Seguimiento global de todos los procesos' : (user.role === 'padrino' ? 'Colaboradores a tu cargo' : 'Tu proceso de formación')}
                </p>
              </div>
              {user.role === 'admin' && (
                <button className="px-4 py-2 bg-[#FF4C29] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#FF4C29]/80 transition-all flex items-center gap-2">
                  <Plus size={16} /> Nuevo Plan
                </button>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-20">
                <Users size={48} className="text-[#334756] mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No tienes planes activos en este momento</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan, index) => (
                  <div 
                    key={`${plan.id}-${index}`}
                    onClick={() => setActivePlan(plan)}
                    className="border-2 border-[#334756] bg-[#082032]/50 rounded-3xl p-6 hover:border-[#FF4C29] hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          plan.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-400' :
                          plan.status === 'En proceso' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-[#334756] text-slate-400'
                        }`}>
                          {plan.status}
                        </span>
                        {unreadCounts[plan.id] > 0 && (
                          <span className="bg-[#FF4C29] text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                            <Bell size={8} fill="currentColor" /> {unreadCounts[plan.id]}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[10px] font-bold flex items-center gap-1">
                        <Calendar size={12} /> {plan.endDate}
                      </span>
                    </div>
                    
                    <div className="mb-6">
                      <h4 className="text-lg font-black text-white uppercase leading-tight group-hover:text-[#FF4C29] transition-colors">
                        {user.role === 'admin' ? plan.apadrinadoName : (plan.otherUser?.name || 'Usuario Desconocido')}
                      </h4>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        {user.role === 'admin' 
                          ? `Padrino: ${plan.padrinoName}` 
                          : `${user.role === 'padrino' ? 'Apadrinado' : 'Padrino'} • ${plan.otherUser?.area || 'Sin área'}`
                        }
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Avance</span>
                        <span className="text-[#FF4C29]">{plan.progress}%</span>
                      </div>
                      <div className="w-full bg-[#334756] h-2 rounded-full overflow-hidden">
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
            <div className="p-6 border-b border-[#334756] flex items-center justify-between shrink-0 bg-[#2C394B]">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActivePlan(null)}
                  className="p-2 hover:bg-[#334756] rounded-xl transition-colors text-slate-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {user.role === 'admin' ? `${activePlan.apadrinadoName} (Apadrinado)` : (activePlan.otherUser?.name || 'Usuario Desconocido')}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {user.role === 'admin' ? `Padrino: ${activePlan.padrinoName}` : 'Plan de Formación • ' + activePlan.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso</div>
                  <div className="text-xl font-black text-[#FF4C29]">{activePlan.progress}%</div>
                </div>
              </div>
            </div>

            {/* Plan Content */}
            <div className="flex-grow flex overflow-hidden">
              {/* Left Column: Tasks & Details */}
              <div className="w-1/2 border-r border-[#334756] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-8">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-[#FF4C29]" /> Detalles del Plan
                  </h4>
                  <div className="bg-[#2C394B] rounded-2xl p-4 space-y-4 border border-[#334756]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha Inicio</span>
                      {activePlan.startDate ? (
                        <span className="text-xs font-bold text-slate-300">{activePlan.startDate}</span>
                      ) : (user.role === 'padrino' || user.role === 'admin') ? (
                        <input 
                          type="date" 
                          onChange={(e) => handleUpdateStartDate(e.target.value)}
                          className="text-xs bg-[#334756] border border-[#334756] text-white rounded-lg px-2 py-1 outline-none focus:border-[#FF4C29]"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-500 italic">Pendiente</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha Fin</span>
                      <span className="text-xs font-bold text-slate-300">{activePlan.endDate || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#FF4C29]" /> Tareas y Habilidades
                  </h4>
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No hay tareas asignadas aún.</p>
                    ) : (
                      tasks.map(task => (
                        <div 
                          key={task.id} 
                          className={`flex items-start gap-3 p-4 rounded-2xl border ${
                            task.isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#2C394B] border-[#334756]'
                          }`}
                        >
                          <button 
                            onClick={() => handleToggleTask(task)}
                            disabled={user.role !== 'padrino' && user.role !== 'admin'}
                            className={`mt-0.5 transition-colors ${
                              task.isCompleted ? 'text-emerald-500' : 'text-slate-500 hover:text-[#FF4C29]'
                            } ${(user.role !== 'padrino' && user.role !== 'admin') ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            {task.isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </button>
                          <div>
                            <p className={`text-xs font-bold ${task.isCompleted ? 'text-slate-400 line-through opacity-70' : 'text-slate-200'}`}>
                              {task.description}
                            </p>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                              task.isCompleted ? 'text-emerald-400' : 'text-slate-500'
                            }`}>
                              {task.isCompleted ? 'Completado' : 'Pendiente'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}

                    {(user.role === 'padrino' || user.role === 'admin') && (
                      isAddingTask ? (
                        <form onSubmit={handleAddTask} className="mt-4 flex gap-2">
                          <input 
                            type="text" 
                            value={newTaskDesc}
                            onChange={(e) => setNewTaskDesc(e.target.value)}
                            placeholder="Descripción de la tarea..."
                            className="flex-grow bg-[#2C394B] border border-[#334756] text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-[#FF4C29]"
                            autoFocus
                          />
                          <button type="submit" className="bg-[#FF4C29] text-white p-2 rounded-xl hover:bg-[#FF4C29]/80">
                            <Plus size={16} />
                          </button>
                          <button type="button" onClick={() => setIsAddingTask(false)} className="bg-[#334756] text-white p-2 rounded-xl hover:bg-[#334756]/80">
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <button 
                          onClick={() => setIsAddingTask(true)}
                          className="mt-4 w-full py-3 border-2 border-dashed border-[#334756] rounded-2xl text-slate-500 hover:text-[#FF4C29] hover:border-[#FF4C29]/30 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                        >
                          <Plus size={16} /> Agregar Tarea
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Chat */}
              <div className="w-1/2 flex flex-col bg-[#082032]/50">
                <div className="p-4 border-b border-[#334756] bg-[#2C394B] shrink-0 flex items-center justify-between">
                  <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} className="text-[#FF4C29]" /> Chat del Plan
                  </h4>
                  {user.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      {showConfirmClear ? (
                        <div className="flex items-center gap-2 bg-rose-500/10 p-1 rounded-lg border border-rose-500/20">
                          <span className="text-[8px] font-bold text-rose-400 uppercase">¿Borrar todo?</span>
                          <button 
                            onClick={handleClearChat}
                            className="text-[9px] font-black bg-rose-500 text-white px-2 py-1 rounded-md hover:bg-rose-600 transition-colors"
                          >
                            Sí
                          </button>
                          <button 
                            onClick={() => setShowConfirmClear(false)}
                            className="text-[9px] font-black bg-[#334756] text-white px-2 py-1 rounded-md hover:bg-[#334756]/80 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowConfirmClear(true)}
                          className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                        >
                          Limpiar Chat
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageSquare size={32} className="text-[#334756] mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No hay mensajes aún</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMine = msg.senderId === user.id;
                      const timeString = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={msg.id} className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-3 max-w-[80%] shadow-sm ${
                            isMine 
                              ? 'bg-[#FF4C29] text-white rounded-2xl rounded-tr-none' 
                              : 'bg-[#2C394B] border border-[#334756] text-white rounded-2xl rounded-tl-none'
                          }`}>
                            {msg.text && <p className={`text-xs ${isMine ? 'text-white' : 'text-slate-200'}`}>{msg.text}</p>}
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
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{timeString}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 bg-[#2C394B] border-t border-[#334756] shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-[#082032] border border-[#334756] rounded-2xl p-2 focus-within:border-[#FF4C29] focus-within:ring-2 focus-within:ring-[#FF4C29]/20 transition-all">
                    <button type="button" className="p-2 text-slate-400 hover:text-[#FF4C29] transition-colors">
                      <Paperclip size={18} />
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
                      className="p-2 bg-[#FF4C29] text-white rounded-xl hover:bg-[#FF4C29]/80 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeopleModule;
