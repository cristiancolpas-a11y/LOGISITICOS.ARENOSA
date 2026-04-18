
export type DocumentStatus = 'active' | 'warning' | 'critical' | 'expired';

export interface VehicleDocument {
  expiryDate: string;
  lastRenewalDate: string;
  status: DocumentStatus;
  url?: string;
  daysPending?: number;
}

export interface Calibration {
  id: string;
  plate: string;
  equipment: string;
  cd?: string;
  contractor?: string;
  calibrationDate: string;
  expiryDate: string;
  certificateUrl?: string;
  status: DocumentStatus;
  daysPending?: number;
  month?: string;
  week?: string;
  estado?: string;
  year?: number;
}

export interface Fine {
  id: string;
  date: string; // Fecha Infracción (Index 12)
  month?: string; // Mes (Index 0)
  registrationDate?: string; // Fecha Registro (Index 1)
  plate: string; // Placa (Index 14 - Hidden/App Logic)
  infractionCode: string; // N° Comp (Index 11)
  description: string; // Concepto (Index 13)
  amount: number; // Valor (Index 10)
  status: 'PENDIENTE' | 'PAGADO'; // Tiene SI/NO (Index 8)
  evidenceUrl?: string; // Comprobante (Index 7)
  cd?: string; // CD (Index 2)
  contractor?: string; // Contratista (Index 3)
  driverName?: string; // Nombres (Index 4)
  driverId?: string; // Cédula (Index 5)
  driverPosition?: string; // Cargo (Index 6)
  paymentAgreement?: string; // Acuerdo de Pago (Index 9)
  week?: string;
  // Campos de Seguimiento Documental (Extraídos de la misma hoja)
  soatExpiry?: string;   // Index 15
  rtmExpiry?: string;    // Index 16
  extExpiry?: string;    // Index 17
}

export interface Driver {
  id: string;
  name: string;
  identification: string;
  hireDate: string;
  position?: string;
  status?: string;
  experienceTime?: string;
  licenseIssueDate?: string;
  photoUrl?: string;
  cd?: string;
  contractor?: string;
  license: VehicleDocument;
  defensiveDriving: VehicleDocument;
  medicalExam: VehicleDocument;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  cd?: string;
  contractor?: string;
  week?: string;
  soat: VehicleDocument;
  rtm: VehicleDocument;
  plc: VehicleDocument;
  extinguisher: VehicleDocument;
  calibration?: VehicleDocument;
  currentMileage?: number;
  lastMileageUpdate?: string;
  propertyCardUrl?: string;
  lastUpdate: string;
}

export interface MileageLog {
  date: string;
  plate: string;
  mileage: number;
  cd: string;
  contractor: string;
  week?: string;
}

export interface WorkshopRecord {
  id: string;
  month: string;
  week: string;
  date: string;
  plate: string;
  status: string;
  novelty: string;
  evidence1Url?: string;
  evidence2Url?: string;
  workshopName: string;
}

export interface SafetyRecord {
  id: string;
  dateRaised: string; // Index 0
  location: string; // Index 1
  insideOutside: string; // Index 2
  reportType: string; // Index 3
  reportedBy: string; // Index 4
  reporterQR: string; // Index 5
  area: string; // Index 6
  hcName: string; // Index 7
  contractor: string; // Index 8
  area2: string; // Index 9
  validator: number; // Index 10
}

export interface StaffMember {
  id: string;
  cedula: string;
  nombre: string;
  qr: string;
  area: string;
  goals: {
    'ENERO': number;
    'FEBRERO': number;
    'MARZO': number;
    'ABRIL': number;
    'MAYO': number;
    'JUNIO': number;
    'JULIO': number;
    'AGOSTO': number;
    'SEPTIEMBRE': number;
    'OCTUBRE': number;
    'NOVIEMBRE': number;
    'DICIEMBRE': number;
  };
}

export interface Report {
  id: string;
  date: string;
  plate: string;
  source: string;
  novelty: string;
  initialEvidence?: string;
  entryMap?: string;
  status: 'ABIERTO' | 'CERRADO';
  workshopEvidence?: string;
  closureDate?: string;
  solutionEvidence?: string;
  exitMap?: string;
  daysInShop?: number;
  closureComments?: string;
  workshop?: string;
  cd?: string;
  contractor?: string;
  week?: string;
  driverName?: string;
}

export interface WashReport {
  id: string;
  month: string;
  week: string;
  date: string;
  plate: string;
  evidenceUrl: string;
  initialEvidenceUrl?: string;
  finalEvidenceUrl?: string;
  mapUrl: string;
  workshop: string;
  status?: 'ABIERTO' | 'CERRADO';
  closureDate?: string;
}

export interface Preventive {
  id: string;
  cd: string;
  contractor: string;
  plate: string;
  lastMaintenanceMileage: number;
  nextMaintenanceMileage: number;
  currentMileage: number;
  kmsToNext: number;
  status: 'ok' | 'warning' | 'critical';
  lastUpdate?: string;
  week?: string;
  month?: string;
  evidenceUrl?: string;
  complianceStatus?: string;
  validationStatus?: string;
  frequency?: number;
  difference?: number;
}

export interface FleetComposition {
  cd: string;
  contractor: string;
  count: number;
}

export interface AvailabilityRecord {
  id: string;
  date: string;
  cd: string;
  system: string;
  detail: string;
  plate: string;
  workshop: string;
  entryDate: string;
  estimatedExitDate: string;
  contractor: string;
  daysUnavailable: number;
  fullPlate: string;
}

export interface OperationalIndicator {
  id: string;
  month: string;
  week: string;
  cd: string;
  indicator: string;
  actual: number;
  trigger: number;
  meta: number;
}

export interface CashlessRecord {
  id: string;
  codigoCliente: string;
  cliente: string;
  barrio: string;
  direccion: string;
  municipio: string;
  freRegularDias: string;
  visitas: string;
  nivelRiesgo: string;
  validador: string;
  fechaEjecucion: string;
  fechaProgramacion: string;
  calificacion: string;
  evidenciaUrl?: string;
  mapUrl?: string;
}

export interface PeopleUser {
  id: string;
  name: string;
  identification: string;
  accessCode: string;
  role?: 'padrino' | 'apadrinado' | 'admin';
  area?: string;
}

export interface MentorshipPlan {
  id: string;
  padrinoId: string;
  padrinoCode?: string;
  apadrinadoId: string;
  apadrinadoCode?: string;
  startDate: string;
  endDate: string;
  status: 'Activo' | 'En proceso' | 'Finalizado';
  progress: number;
  padrinoName?: string;
  apadrinadoName?: string;
  planIdBase?: string; // Relación con ID_Base de Tareas
}

export interface MedicalRecord {
  id: string;
  name: string;             // Columna A (0)
  joiningDate: string;      // Columna B (1)
  month: string;            // Columna C (2)
  lastExamDate: string;     // Columna D (3)
  expiryDate: string;       // Columna E (4)
  daysRemaining: string;    // Columna F (5)
  rawStatus: string;        // Columna G (6)
  status: 'VIGENTE' | 'POR VENCER' | 'VENCIDO'; // Logic based status
  observations: string;
  contractor: string;
  position: string;      // Columna I (8)
  area: string;          // Columna J (9)
  examType: string;      // Columna K (10)
  weightRec: string;     // Columna X (23)
  laboralRec: string;    // Columna AC (28)
}

export interface MentorshipTask {
  id: string;
  idBase: string;
  padrino: string;
  codPadrino: string;
  apadrinado: string;
  codApadrinado: string;
  subnivel: string;
  tarea: string;
  pilar: string;
  matriz: string;
  estado: string;
  fechaCreacion: string;
  validador: string;
  evidencia: string;
  isCompleted?: boolean;
  evidenceUrl?: string;
  evidenceName?: string;
  evidenceType?: string;
  uploadedAt?: string;
}
