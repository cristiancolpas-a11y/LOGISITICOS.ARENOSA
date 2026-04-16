
import Papa from 'papaparse';
import { Vehicle, Driver, Report, MileageLog, Calibration, WashReport, Fine, Preventive, AvailabilityRecord, FleetComposition, OperationalIndicator, WorkshopRecord, SafetyRecord, StaffMember, CashlessRecord, PeopleUser, MentorshipPlan, MentorshipTask } from '../types';
import { calculateStatus, normalizePlate, normalizeStr, getDaysDiff } from '../utils';

const GOOGLE_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzqKd-TD93Z_qC-aTBD3zfrytKTBHSA5GYERQYIdVJaFIb02r33RITFlipHp43sLuhe/exec'; 
const GOOGLE_SCRIPT_FINES_URL = 'https://script.google.com/macros/s/AKfycbxVjLry2rjYYsFLk_3PERq5KH39P73Oda3LFPKOu2uVammhZenY0I01-SeDU0tAy9uk/exec';
const GOOGLE_SCRIPT_WORKSHOP_URL = 'https://script.google.com/macros/s/AKfycbxU8y_M1pACZaBf92uc0W01I4UqCqmOwnt7uUZSTezkSMQZgXYSLGv0laaGlR9UGJ8q/exec';
const GOOGLE_SCRIPT_MENTORSHIP_URL = 'https://script.google.com/macros/s/AKfycbzqKd-TD93Z_qC-aTBD3zfrytKTBHSA5GYERQYIdVJaFIb02r33RITFlipHp43sLuhe/exec';

// HOJA MAESTRA (Donde se encuentran los Vehículos y Conductores)
const REAL_MASTER_ID = '1GPfhWOUM8As4vVRirzWgSzFwvQ01I6EAc14uGoWc98U';
const BASE_URL_MASTER = `https://docs.google.com/spreadsheets/d/${REAL_MASTER_ID}/export?format=csv`;

// HOJA OPERATIVA / BACKEND
const BACKEND_DOC_ID = '1lRQGdS6aNJnDCPpkieWj-EEb3RAbp1-zY7uWVt-7UQU';
const BASE_URL_BACKEND = `https://docs.google.com/spreadsheets/d/${BACKEND_DOC_ID}/export?format=csv`;

// ID de la hoja de Comparendos
const FINES_SHEET_ID = '1WnzEFfVMTHZVVKWGTMLU2WjY-GIzSRpWz52i_Es0E1M';
const BASE_URL_FINES = `https://docs.google.com/spreadsheets/d/${FINES_SHEET_ID}/export?format=csv`;

// HOJA CASHLESS
const CASHLESS_DOC_ID = '1wyWYtEgi2eA2b-8DDpqr7l0SXF6-nG6oM71s8Gfwi04';
const BASE_URL_CASHLESS = `https://docs.google.com/spreadsheets/d/${CASHLESS_DOC_ID}/export?format=csv`;

// HOJA PLAN PADRINO
const PLAN_PADRINO_DOC_ID = '1yt6Hr-RIGTca21zPwq2bn1KkbpRNvEJ6lm4VL76Q_Co';
const BASE_URL_PLAN_PADRINO = `https://docs.google.com/spreadsheets/d/${PLAN_PADRINO_DOC_ID}/gviz/tq?tqx=out:csv`;

const getCacheBuster = () => `&t=${new Date().getTime()}`;

const cleanSheetValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  // Eliminar espacios en blanco y caracteres invisibles/especiales
  return String(val).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
};

const parseFlexibleDate = (dateStr: any): string => {
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  const cleanStr = cleanSheetValue(dateStr);
  if (!cleanStr || cleanStr.toLowerCase().includes('fecha')) return '';
  
  try {
    // Si ya viene en formato YYYY-MM-DD, lo devolvemos tal cual para evitar desfases de zona horaria
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return cleanStr;
    }

    const parts = cleanStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) { 
        year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
      } else { 
        day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      }
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) {
        const y = d2.getFullYear();
        const m = String(d2.getMonth() + 1).padStart(2, '0');
        const d = String(d2.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      // Si el string no tiene hora, Date(string) asume UTC. 
      // Para evitar que d.getDate() devuelva el día anterior, usamos los métodos UTC si el string parece ISO
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return '';
  } catch { return ''; }
};

/**
 * VEHÍCULOS (Hoja ALERTA_CAMIONES - GID 1506825194)
 */
export const fetchVehiclesFromSheet = async (): Promise<Vehicle[]> => {
  try {
    const url = `${BASE_URL_MASTER}&gid=1506825194${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, 
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length === 0) { resolve([]); return; }
          
          const vehicles: Vehicle[] = [];
          let lastCd = 'GENERAL';
          let lastCnt = 'GENERAL';

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 3) continue;

            const currentCd = cleanSheetValue(row[0]).toUpperCase();
            const currentCnt = cleanSheetValue(row[1]).toUpperCase();
            if (currentCd && !currentCd.includes('CENTRO') && !currentCd.includes('CD')) lastCd = currentCd;
            if (currentCnt && !currentCnt.includes('CONTRATISTA') && !currentCnt.includes('OPERADOR')) lastCnt = currentCnt;

            const rawPlate = cleanSheetValue(row[2]);
            const plate = normalizePlate(rawPlate);

            if (plate && !plate.includes("PLACA") && plate.length >= 2) {
              const soatDate = parseFlexibleDate(row[3]);
              const rtmDate = parseFlexibleDate(row[5]);
              const plcDate = parseFlexibleDate(row[7]);
              const extDate = parseFlexibleDate(row[9]);
              
              vehicles.push({
                id: `v-${plate}-${i}`, 
                cd: lastCd,
                contractor: lastCnt,
                brand: "Vehículo", 
                plate, 
                model: "Unidad",
                soat: { 
                  expiryDate: soatDate, 
                  lastRenewalDate: '', 
                  status: calculateStatus(soatDate), 
                  daysPending: getDaysDiff(soatDate), 
                  url: cleanSheetValue(row[20])
                },
                rtm: { 
                  expiryDate: rtmDate, 
                  lastRenewalDate: '', 
                  status: calculateStatus(rtmDate),
                  daysPending: getDaysDiff(rtmDate),
                  url: cleanSheetValue(row[21])
                },
                plc: {
                  expiryDate: plcDate,
                  lastRenewalDate: '',
                  status: calculateStatus(plcDate),
                  daysPending: getDaysDiff(plcDate),
                  url: cleanSheetValue(row[22])
                },
                extinguisher: {
                  expiryDate: extDate,
                  lastRenewalDate: '',
                  status: calculateStatus(extDate),
                  daysPending: getDaysDiff(extDate)
                },
                propertyCardUrl: cleanSheetValue(row[19]),
                lastUpdate: new Date().toISOString()
              });
            }
          }
          resolve(vehicles);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { 
    return []; 
  }
};

/**
 * VISITAS A TALLER (GID 239875479 - Hoja Operativa)
 */
export const fetchWorkshopVisitsFromSheet = async (): Promise<Report[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=239875479${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const visits = rows.slice(1)
            .filter(row => row && row[2]) 
            .map((row, i): Report => {
              const week = cleanSheetValue(row[0]);
              const dateProg = parseFlexibleDate(row[1]);
              const identifier = cleanSheetValue(row[2]);
              const workshop = cleanSheetValue(row[3]);
              const dateVis = parseFlexibleDate(row[4]);
              const evidence = cleanSheetValue(row[5]);
              const statusRaw = cleanSheetValue(row[6]).toUpperCase();
              const hashId = cleanSheetValue(row[7]); 
              const driverName = cleanSheetValue(row[8]);
              
              // Solo es CERRADO si el estado es CERRADO
              const isClosed = statusRaw.includes('CERRADO');
              
              return {
                id: hashId || `vprog-${i}`,
                week: week,
                date: dateProg,
                plate: normalizePlate(identifier),
                workshop: workshop,
                closureDate: dateVis,
                status: isClosed ? 'CERRADO' : 'ABIERTO',
                novelty: 'VISITA TÉCNICA PROGRAMADA',
                source: 'CALENDARIO',
                initialEvidence: evidence,
                cd: 'GENERAL',
                driverName: driverName
              } as any;
            });
          resolve(visits);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * KILOMETRAJE (GID 1929496440)
 */
export const fetchMileageLogsFromSheet = async (): Promise<MileageLog[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=1929496440${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          const logs = rows.slice(1).filter(row => row && row[4]).map((row): MileageLog => ({
            cd: cleanSheetValue(row[0]),          
            contractor: cleanSheetValue(row[1]),  
            week: cleanSheetValue(row[2]),        
            date: parseFlexibleDate(row[3]),      
            plate: normalizePlate(cleanSheetValue(row[4])), 
            mileage: parseInt(cleanSheetValue(row[5])) || 0 
          }));
          resolve(logs);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * CALIBRACIONES (GID 505557891)
 */
export const fetchCalibrationsFromSheet = async (): Promise<Calibration[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=505557891${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          const calibrations = rows.slice(1).filter(row => row && row[3]).map((row, index): Calibration => {
            const calDateStr = parseFlexibleDate(row[1]);
            const expDate = calDateStr ? new Date(calDateStr + 'T12:00:00') : null;
            const year = expDate ? expDate.getFullYear() : undefined;
            const monthVal = cleanSheetValue(row[0]) || (expDate ? expDate.toLocaleString('es-ES', { month: 'long' }).toUpperCase() : 'GENERAL');
            const week = cleanSheetValue(row[2]);
            const plate = normalizePlate(cleanSheetValue(row[3])); 
            const workshop = cleanSheetValue(row[4]);             
            const evidenceUrl = cleanSheetValue(row[5]);
            const estado = cleanSheetValue(row[6]).toUpperCase();
            
            if (expDate) expDate.setFullYear(expDate.getFullYear() + 1);
            const expDateStr = expDate ? expDate.toISOString().split('T')[0] : '';
            return {
              id: `cal-${plate}-${calDateStr}-${index}`,
              plate,
              equipment: workshop || 'TALLER NO ESPECIFICADO',
              calibrationDate: calDateStr,
              expiryDate: expDateStr,
              certificateUrl: evidenceUrl,
              status: calculateStatus(expDateStr),
              daysPending: getDaysDiff(expDateStr),
              month: monthVal,
              week,
              estado,
              year,
              cd: 'GENERAL'
            };
          });
          resolve(calibrations);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * LAVADOS (Hoja LAVADOS)
 */
export const fetchWashReportsFromSheet = async (): Promise<WashReport[]> => {
  try {
    // Usamos el nombre de la hoja en lugar del GID para mayor fiabilidad
    const url = `https://docs.google.com/spreadsheets/d/${BACKEND_DOC_ID}/gviz/tq?tqx=out:csv&sheet=LAVADOS${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          // Intentamos identificar las columnas si hay cabecera
          const header = rows[0].map(h => String(h).toUpperCase());
          let plateIdx = header.findIndex(h => h.includes('PLACA'));
          let dateIdx = header.findIndex(h => h.includes('FECHA'));
          let monthIdx = header.findIndex(h => h.includes('MES'));
          let weekIdx = header.findIndex(h => h.includes('SEMANA'));
          let evidenceIdx = header.findIndex(h => h.includes('EVIDENCIA') || h.includes('FOTO'));

          // Fallbacks si no hay cabecera clara
          if (plateIdx === -1) plateIdx = 4;
          if (dateIdx === -1) dateIdx = 3;
          if (monthIdx === -1) monthIdx = 1;
          if (weekIdx === -1) weekIdx = 2;
          if (evidenceIdx === -1) evidenceIdx = 5;

          const reports = rows.slice(1)
            .filter(row => row && (row[plateIdx] || row[dateIdx]))
            .map((row, i): WashReport => {
              const plate = normalizePlate(cleanSheetValue(row[plateIdx]));
              const date = parseFlexibleDate(row[dateIdx]);
              let month = cleanSheetValue(row[monthIdx]);
              const evidence = cleanSheetValue(row[evidenceIdx]);
              
              if (!month && date) {
                const d = new Date(date + "T12:00:00");
                if (!isNaN(d.getTime())) {
                  month = d.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
                }
              }

              return {
                id: `wash-${i}-${plate}-${date}`,
                month: month || 'GENERAL',
                week: cleanSheetValue(row[weekIdx]),
                date: date,
                plate: plate,
                evidenceUrl: evidence,
                initialEvidenceUrl: evidence,
                finalEvidenceUrl: evidence,
                mapUrl: cleanSheetValue(row[6]),
                workshop: cleanSheetValue(row[7]),
                status: 'CERRADO'
              };
            });
          resolve(reports);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * LIMPIEZA (GID 1853969081 - CRONOGRAMA 5S)
 */
export const fetchCleaningReportsFromSheet = async (): Promise<WashReport[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=1853969081${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const reports = rows.slice(1)
            .filter(row => row && (row[3] || row[0]))
            .map((row, i): WashReport => {
              const dateProg = parseFlexibleDate(row[0]);
              let month = cleanSheetValue(row[1]);
              const week = cleanSheetValue(row[2]);
              const plate = normalizePlate(cleanSheetValue(row[3]));
              const statusRaw = cleanSheetValue(row[4]).toUpperCase();
              const initialEvidence = cleanSheetValue(row[5]);
              const finalEvidence = cleanSheetValue(row[6]);
              
              // Fallback: if month is empty, try to derive it from date
              if (!month && dateProg) {
                const d = new Date(dateProg + "T12:00:00");
                if (!isNaN(d.getTime())) {
                  month = d.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
                }
              }

              const isClosed = statusRaw.includes('COMPLETADO') || statusRaw.includes('CERRADO');

              return {
                id: `clean-${i}-${plate}-${dateProg}`, 
                month: month || 'GENERAL', 
                week: week,
                date: dateProg, 
                plate: plate,
                evidenceUrl: finalEvidence || initialEvidence, 
                initialEvidenceUrl: initialEvidence,
                finalEvidenceUrl: finalEvidence,
                mapUrl: '', 
                workshop: '', 
                status: isClosed ? 'CERRADO' : 'ABIERTO',
                closureDate: isClosed ? dateProg : undefined 
              };
            });
          resolve(reports);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * CONDUCTORES (GID 1834987510)
 */
export const fetchDriversFromSheet = async (): Promise<Driver[]> => {
  try {
    const url = `${BASE_URL_MASTER}&gid=1834987510${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          const drivers = rows.slice(1).filter(row => row && row[2]).map((row): Driver => {
            const licExp = parseFlexibleDate(row[9]);
            const courseExp = parseFlexibleDate(row[11]);
            const medicalExp = parseFlexibleDate(row[13]);
            
            return {
              id: `d-${cleanSheetValue(row[3])}`,
              name: cleanSheetValue(row[2]),
              identification: cleanSheetValue(row[3]),
              hireDate: parseFlexibleDate(row[6]),
              position: cleanSheetValue(row[4]),
              status: cleanSheetValue(row[5]),
              experienceTime: cleanSheetValue(row[8]),
              licenseIssueDate: parseFlexibleDate(row[7]),
              photoUrl: cleanSheetValue(row[21]),
              cd: cleanSheetValue(row[0]),
              contractor: cleanSheetValue(row[1]),
              license: { 
                expiryDate: licExp, 
                lastRenewalDate: '', 
                status: calculateStatus(licExp), 
                url: cleanSheetValue(row[18]), 
                daysPending: getDaysDiff(licExp) 
              },
              defensiveDriving: { 
                expiryDate: courseExp, 
                lastRenewalDate: '', 
                status: calculateStatus(courseExp), 
                url: cleanSheetValue(row[19]),
                daysPending: getDaysDiff(courseExp)
              },
              medicalExam: { 
                expiryDate: medicalExp, 
                lastRenewalDate: '', 
                status: calculateStatus(medicalExp), 
                url: cleanSheetValue(row[20]),
                daysPending: getDaysDiff(medicalExp)
              }
            };
          });
          resolve(drivers);
        }
      });
    });
  } catch (e) { return []; }
};

/**
 * NOVEDADES (GID 1789987673)
 */
export const fetchReportsFromSheet = async (): Promise<Report[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=1789987673${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows) { resolve([]); return; }
          const reports = rows.slice(1).filter(row => row && row[0]).map((row): Report => {
            const solutionEvidence = cleanSheetValue(row[10]);
            const isClosed = cleanSheetValue(row[7]).toUpperCase().includes('CERRADO');

            return {
              id: cleanSheetValue(row[0]), 
              date: parseFlexibleDate(row[1]), 
              plate: normalizePlate(cleanSheetValue(row[2])), 
              source: cleanSheetValue(row[3]), 
              initialEvidence: cleanSheetValue(row[4]), 
              novelty: cleanSheetValue(row[5]), 
              entryMap: cleanSheetValue(row[6]), 
              status: isClosed ? 'CERRADO' : 'ABIERTO', 
              workshopEvidence: cleanSheetValue(row[8]), 
              closureDate: parseFlexibleDate(row[9]), 
              solutionEvidence: solutionEvidence, 
              exitMap: cleanSheetValue(row[11]), 
              daysInShop: parseInt(cleanSheetValue(row[12])) || 0, 
              closureComments: cleanSheetValue(row[13]), 
              workshop: cleanSheetValue(row[14]), 
              cd: cleanSheetValue(row[15])
            };
          });
          resolve(reports);
        }
      });
    });
  } catch (e) { return []; }
};

/**
 * COMPARENDOS
 */
export const fetchFinesFromSheet = async (): Promise<Fine[]> => {
  try {
    const url = `${BASE_URL_FINES}&gid=0${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = (await response.text()) + "\n";
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: false,
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length === 0) { resolve([]); return; }
          
          // Skip the first row if it's the header "MES"
          const startIdx = (rows[0] && cleanSheetValue(rows[0][0]).toUpperCase() === 'MES') ? 1 : 0;
          
          const fines = rows.slice(startIdx)
            .filter(r => r && r.some(c => cleanSheetValue(c).length > 0))
            .map((row, i): Fine => {
              return {
                id: `row-${startIdx + i + 1}`,
                month: cleanSheetValue(row[0]),
                registrationDate: parseFlexibleDate(row[1]),
                cd: cleanSheetValue(row[2]),
                contractor: cleanSheetValue(row[3]),
                driverName: cleanSheetValue(row[4]),
                driverId: cleanSheetValue(row[5]),
                driverPosition: cleanSheetValue(row[6]),
                amount: parseFloat(cleanSheetValue(row[9])) || 0,
                status: cleanSheetValue(row[8]).toUpperCase().includes('SI') ? 'PENDIENTE' : 'PAGADO',
                paymentAgreement: cleanSheetValue(row[8]),
                evidenceUrl: cleanSheetValue(row[7]).startsWith('http') ? cleanSheetValue(row[7]) : '',
                infractionCode: cleanSheetValue(row[10]),
                date: parseFlexibleDate(row[11]),
                description: cleanSheetValue(row[12]),
                plate: normalizePlate(cleanSheetValue(row[17]))
              } as any;
            });
          resolve(fines);
        }
      });
    });
  } catch { return []; }
};

/**
 * PREVENTIVOS (GID 1668814480)
 */
export const fetchPreventivesFromSheet = async (): Promise<Preventive[]> => {
  try {
    const url = `${BASE_URL_BACKEND}&gid=1668814480${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          // SEM: 0, MES: 1, FECHA: 2, PLACA: 3, FREC: 4, ULTIMO: 5, PROX: 6, REGISTRADO: 7, DIF: 8, RANGO: 9, VALIDACION: 10, EVIDENCIA: 11
          const preventives = rows.slice(1)
            .filter(row => row && row[3]) // Placa en indice 3
            .map((row, i): Preventive => {
              const plate = normalizePlate(cleanSheetValue(row[3]));
              const lastKm = parseInt(cleanSheetValue(row[5])) || 0;
              const nextKm = parseInt(cleanSheetValue(row[6])) || 0;
              const currentKm = parseInt(cleanSheetValue(row[7])) || 0;
              const kmsToNext = parseInt(cleanSheetValue(row[8])) || (nextKm - currentKm);
              const complianceStatus = cleanSheetValue(row[9]); // CUMPLIMIENTO EN RANGOS
              const validationStatus = cleanSheetValue(row[10]); // VALIDACIÓN CUMPLIMIENTO
              const evidence = cleanSheetValue(row[11]);
              
              const combinedStatus = (complianceStatus + " " + validationStatus).toLowerCase();
              
              let status: 'ok' | 'warning' | 'critical' = 'ok';
              if (combinedStatus.includes('no cumplió') || combinedStatus.includes('no cumplio') || combinedStatus.includes('critico') || combinedStatus.includes('vencido') || combinedStatus.includes('fuera')) status = 'critical';
              else if (combinedStatus.includes('proximo') || combinedStatus.includes('alerta') || combinedStatus.includes('rango')) status = 'warning';
              else if (kmsToNext < 500) status = 'critical';
              else if (kmsToNext < 1000) status = 'warning';

              return {
                id: `prev-${plate}-${i}`,
                cd: 'GENERAL',
                contractor: 'GENERAL',
                plate: plate,
                currentMileage: currentKm,
                nextMaintenanceMileage: nextKm,
                lastMaintenanceMileage: lastKm,
                kmsToNext: kmsToNext,
                status: status,
                lastUpdate: parseFlexibleDate(row[2]),
                week: cleanSheetValue(row[0]),
                month: cleanSheetValue(row[1]),
                complianceStatus: complianceStatus,
                validationStatus: validationStatus,
                evidenceUrl: evidence,
                frequency: parseInt(cleanSheetValue(row[4])) || 5000,
                difference: parseInt(cleanSheetValue(row[8])) || 0
              };
            });
          resolve(preventives);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchAvailabilityFromSheet = async (): Promise<AvailabilityRecord[]> => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/1NTOAqE9fD5qepaAqQ1s_AbvilYHaQGl7f9fIPW_mq8E/gviz/tq?tqx=out:csv&sheet=disponibilidadd${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const records = rows.slice(1)
            .filter(row => row && row[9]) // Placa en indice 9 (Col J)
            .map((row, i): AvailabilityRecord => {
              return {
                id: `avail-${i}`,
                date: cleanSheetValue(row[1]),
                cd: cleanSheetValue(row[18]),
                system: cleanSheetValue(row[3]),
                detail: cleanSheetValue(row[4]),
                workshop: cleanSheetValue(row[6]),
                entryDate: cleanSheetValue(row[7]),
                estimatedExitDate: cleanSheetValue(row[8]),
                plate: cleanSheetValue(row[9]),
                contractor: cleanSheetValue(row[10]),
                daysUnavailable: parseInt(cleanSheetValue(row[11])) || 0,
                fullPlate: normalizePlate(cleanSheetValue(row[9]))
              };
            });
          resolve(records);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchOperationalIndicatorsFromSheet = async (): Promise<OperationalIndicator[]> => {
  try {
    const docId = '1nKlDzFSZxh9NiWTJgkx2ASIJMbHMSribN3MZ-4mClVU';
    const url = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&sheet=TABLERO${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    const parseNumericValue = (val: string): number => {
      if (!val) return 0;
      const cleaned = val.replace('%', '').replace(',', '.').trim();
      return parseFloat(cleaned) || 0;
    };

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const indicators = rows.slice(1)
            .filter(row => row && row[3]) // Indicador en indice 3
            .map((row, i): OperationalIndicator => {
              return {
                id: `op-${i}`,
                month: cleanSheetValue(row[0]),
                week: cleanSheetValue(row[1]),
                cd: cleanSheetValue(row[2]),
                indicator: cleanSheetValue(row[3]),
                actual: parseNumericValue(cleanSheetValue(row[4])),
                trigger: parseNumericValue(cleanSheetValue(row[5])),
                meta: parseNumericValue(cleanSheetValue(row[6])),
              };
            });
          resolve(indicators);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchWorkshopRecordsFromSheet = async (): Promise<WorkshopRecord[]> => {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/1rrY2XyCYqZyAbCJtEOWuPxAtWaQ_lmqG28KQz5w_NSo/gviz/tq?tqx=out:csv&sheet=TALLERES';
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          // 0:MES, 1:SEMANA, 2:FECHA, 3:PLACA, 4:ESTADO, 5:NOVEDAD, 6:EVIDENCIA_1, 7:EVIDENCIA_2, 8:MÁS ALTO
          const records = rows.slice(1)
            .filter(row => row && row[3]) // Placa en indice 3
            .map((row, i): WorkshopRecord => {
              return {
                id: `workshop-${i}`,
                month: cleanSheetValue(row[0]),
                week: cleanSheetValue(row[1]),
                date: parseFlexibleDate(row[2]),
                plate: normalizePlate(cleanSheetValue(row[3])),
                status: cleanSheetValue(row[4]),
                novelty: cleanSheetValue(row[5]),
                evidence1Url: cleanSheetValue(row[6]),
                evidence2Url: cleanSheetValue(row[7]),
                workshopName: cleanSheetValue(row[8]),
              };
            });
          resolve(records);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchSafetyReportsFromSheet = async (): Promise<SafetyRecord[]> => {
  try {
    const spreadsheetId = '1FMq5zlcqp08SRpcoG220BgOjsMZmjDPyv8ql0W92PfI';
    const sheetName = 'REPORTE';
    
    const urls = [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${getCacheBuster()}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}${getCacheBuster()}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0${getCacheBuster()}`
    ];

    let csvText = '';
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          if (text && !text.includes("<!DOCTYPE html")) {
            csvText = text;
            break;
          }
        }
      } catch (e) {
        console.warn(`Attempt failed for ${url}:`, e);
      }
    }

    if (!csvText) {
      console.error('Invalid CSV content received for safety reports after all attempts');
      return [];
    }
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, 
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          
          if (!rows || rows.length < 1) { 
            resolve([]); 
            return; 
          }

          // Determine if first row is header by checking if it contains "Fecha" or similar
          const firstRow = rows[0].map(c => cleanSheetValue(c).toLowerCase());
          const hasHeader = firstRow.some(c => c.includes('fecha') || c.includes('ubicación') || c.includes('reporte'));
          
          const dataRows = hasHeader ? rows.slice(1) : rows;
          
          const records = dataRows
            .filter(row => row && row.length >= 6 && row.some(cell => cleanSheetValue(cell).length > 0))
            .map((row, i): SafetyRecord => {
              return {
                id: `safety-${i}`,
                dateRaised: parseFlexibleDate(row[0]) || cleanSheetValue(row[0]), // Index 0
                location: cleanSheetValue(row[1]), // Index 1
                insideOutside: cleanSheetValue(row[2]), // Index 2
                reportType: cleanSheetValue(row[3]), // Index 3
                reportedBy: cleanSheetValue(row[4]), // Index 4
                reporterQR: cleanSheetValue(row[5]), // Index 5
                area: cleanSheetValue(row[6]), // Index 6
                hcName: cleanSheetValue(row[7]), // Index 7
                contractor: cleanSheetValue(row[8]), // Index 8
                area2: cleanSheetValue(row[9]), // Index 9
                validator: parseFloat(cleanSheetValue(row[10])) || 0, // Index 10
              };
            });
          resolve(records);
        },
        error: (err) => {
          console.error('PapaParse error for safety reports:', err);
          resolve([]);
        }
      });
    });
  } catch (e) { 
    console.error('Error in fetchSafetyReportsFromSheet:', e);
    return []; 
  }
};

export const fetchStaffFromSheet = async (): Promise<StaffMember[]> => {
  try {
    const spreadsheetId = '1FMq5zlcqp08SRpcoG220BgOjsMZmjDPyv8ql0W92PfI';
    const sheetName = 'HC';
    
    const urls = [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${getCacheBuster()}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}${getCacheBuster()}`
    ];

    let csvText = '';
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          if (text && !text.includes("<!DOCTYPE html")) {
            csvText = text;
            break;
          }
        }
      } catch (e) {
        console.warn(`Attempt failed for ${url}:`, e);
      }
    }
    
    if (!csvText) return [];
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 1) { resolve([]); return; }
          
          const hasHeader = rows[0].some(c => cleanSheetValue(c).toLowerCase().includes('nombre') || cleanSheetValue(c).toLowerCase().includes('cedula'));
          const dataRows = hasHeader ? rows.slice(1) : rows;
          
          const staff = dataRows
            .filter(row => row && row.length >= 18 && cleanSheetValue(row[1]).length > 0)
            .map((row, i): StaffMember => {
              return {
                id: `staff-${i}`,
                cedula: cleanSheetValue(row[0]), // A
                nombre: cleanSheetValue(row[1]), // B
                qr: cleanSheetValue(row[3]), // D
                area: cleanSheetValue(row[4]), // E
                goals: {
                  'ENERO': parseFloat(cleanSheetValue(row[7])) || 0, // H
                  'FEBRERO': parseFloat(cleanSheetValue(row[8])) || 0, // I
                  'MARZO': parseFloat(cleanSheetValue(row[9])) || 0, // J
                  'ABRIL': parseFloat(cleanSheetValue(row[10])) || 0, // K
                  'MAYO': parseFloat(cleanSheetValue(row[11])) || 0, // L
                  'JUNIO': parseFloat(cleanSheetValue(row[12])) || 0, // M
                  'JULIO': parseFloat(cleanSheetValue(row[13])) || 0, // N
                  'AGOSTO': parseFloat(cleanSheetValue(row[14])) || 0, // O
                  'SEPTIEMBRE': parseFloat(cleanSheetValue(row[15])) || 0, // P
                  'OCTUBRE': parseFloat(cleanSheetValue(row[16])) || 0, // Q
                  'NOVIEMBRE': parseFloat(cleanSheetValue(row[17])) || 0, // R
                  'DICIEMBRE': parseFloat(cleanSheetValue(row[18])) || 0, // S
                }
              };
            });
          resolve(staff);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchCashlessFromSheet = async (): Promise<CashlessRecord[]> => {
  try {
    const url = `${BASE_URL_CASHLESS}&sheet=DETALLE${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const dataRows = rows.slice(1); // Skip header
          const records = dataRows
            .filter(row => row && row.length >= 12 && cleanSheetValue(row[0]).length > 0)
            .map((row, i): CashlessRecord => {
              return {
                id: `cashless-${i}`,
                codigoCliente: cleanSheetValue(row[0]), // A
                cliente: cleanSheetValue(row[1]), // B
                barrio: cleanSheetValue(row[2]), // C
                direccion: cleanSheetValue(row[3]), // D
                municipio: cleanSheetValue(row[4]), // E
                freRegularDias: cleanSheetValue(row[5]), // F
                visitas: cleanSheetValue(row[8]), // I (Numeric Status 1/0)
                nivelRiesgo: cleanSheetValue(row[7]), // H
                validador: cleanSheetValue(row[6]), // G (Visitas Text)
                fechaEjecucion: parseFlexibleDate(row[9]), // J
                fechaProgramacion: parseFlexibleDate(row[10]), // K
                calificacion: cleanSheetValue(row[11]), // L
                evidenciaUrl: cleanSheetValue(row[12]), // M
                mapUrl: cleanSheetValue(row[14]), // O
              };
            });
          resolve(records);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { 
    console.error("Error in fetchCashlessFromSheet:", e);
    return []; 
  }
};

const sendToGAS = async (payload: any, url: string = GOOGLE_SCRIPT_WEB_APP_URL) => {
  console.log(`[GAS] Enviando petición (${payload.method})...`);
  try {
    // Usamos mode: 'no-cors' y text/plain para máxima compatibilidad con GAS
    await fetch(url, { 
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload) 
    });
    
    console.log(`[GAS] Petición enviada con éxito (modo no-cors).`);
    return true; 
  } catch (err) { 
    console.error("[GAS] Error al enviar:", err);
    return false; 
  }
};

export const submitDocumentUpdateToSheet = async (data: any): Promise<void> => { await sendToGAS({ method: 'POST_DOC_UPDATE', data }); };
export const submitReportToSheet = async (report: Report): Promise<void> => { await sendToGAS({ method: 'POST_REPORT', data: report }); };
export const submitMileageToSheet = async (mileageData: any): Promise<void> => { await sendToGAS({ method: 'POST_MILEAGE', data: mileageData }); };
export const submitCalibrationToSheet = async (calibrationDate: any): Promise<void> => { await sendToGAS({ method: 'POST_CALIBRATION', data: calibrationDate }); };
export const submitCalibrationUpdateToSheet = async (data: any): Promise<void> => { await sendToGAS({ method: 'POST_CALIBRATION_UPDATE', data }); };
export const submitWashToSheet = async (washData: any): Promise<void> => { await sendToGAS({ method: 'POST_WASH', data: washData }); };
export const submitCleaningToSheet = async (cleaningData: any): Promise<void> => { await sendToGAS({ method: 'POST_CLEANING', data: cleaningData }); };
export const submitWorkshopVisitUpdateToSheet = async (visitData: any): Promise<void> => { await sendToGAS({ method: 'POST_WORKSHOP_VISIT_UPDATE', data: visitData }); };
export const submitWorkshopRecordToSheet = async (data: any): Promise<void> => { await sendToGAS({ method: 'POST_WORKSHOP_RECORD', data }, GOOGLE_SCRIPT_WORKSHOP_URL); };
export const submitPreventiveUpdateToSheet = async (data: any): Promise<void> => { await sendToGAS({ method: 'POST_PREVENTIVE_UPDATE', data }); };
export const submitFineToSheet = async (data: any): Promise<boolean> => {
  const method = data.updateMode ? 'POST_FINE_UPDATE' : 'POST_FINE';
  return await sendToGAS({ method, data }, GOOGLE_SCRIPT_FINES_URL);
};

/**
 * PEOPLE USERS (Hoja codigos)
 */
export const fetchPeopleUsersFromSheet = async (): Promise<PeopleUser[]> => {
  try {
    const url = `${BASE_URL_PLAN_PADRINO}&sheet=${encodeURIComponent('codigos')}${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const users = rows.slice(1)
            .filter(row => row && row.length >= 2 && row[1]) // Cédula en Col B (Index 1)
            .map((row): PeopleUser => {
              const roleRaw = cleanSheetValue(row[3]).toLowerCase();
              return {
                id: cleanSheetValue(row[1]), // Cédula como ID
                name: cleanSheetValue(row[0]),
                identification: cleanSheetValue(row[1]),
                accessCode: cleanSheetValue(row[2]),
                role: roleRaw.includes('padrino') ? 'padrino' : 'apadrinado',
                area: cleanSheetValue(row[4]) || 'GENERAL'
              };
            });
          resolve(users);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

/**
 * PLAN PADRINO (Hoja Plan_Padrino)
 */
export const fetchMentorshipPlansFromSheet = async (): Promise<MentorshipPlan[]> => {
  try {
    const url = `${BASE_URL_PLAN_PADRINO}&sheet=${encodeURIComponent('Plan_Padrino')}${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          const plans = rows.slice(1)
            .filter(row => row && row[1] && row[3]) // Padrino_ID y Apadrinado_ID
            .map((row, i): MentorshipPlan => ({
              id: cleanSheetValue(row[0]) ? `${cleanSheetValue(row[0])}-${i}` : `plan-${i}`,
              planIdBase: cleanSheetValue(row[0]), // ID de la hoja Plan Padrino
              padrinoId: cleanSheetValue(row[1]),
              padrinoCode: cleanSheetValue(row[2]),
              apadrinadoId: cleanSheetValue(row[3]),
              apadrinadoCode: cleanSheetValue(row[4]),
              startDate: parseFlexibleDate(row[5]),
              endDate: parseFlexibleDate(row[6]),
              status: (cleanSheetValue(row[7]) as any) || 'Activo',
              progress: (() => {
                const val = parseFloat(cleanSheetValue(row[8]).replace(',', '.'));
                if (isNaN(val)) return 0;
                // Si es un decimal <= 1, asumimos que es formato porcentaje de Excel (0.5 = 50%)
                return val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
              })()
            }));
          resolve(plans);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const fetchMentorshipTasksFromSheet = async (planId?: string): Promise<MentorshipTask[]> => {
  try {
    const url = `${BASE_URL_PLAN_PADRINO}&sheet=${encodeURIComponent('Tareas')}${getCacheBuster()}`;
    const response = await fetch(url);
    const csvText = await response.text();
    if (!csvText || csvText.includes("<!DOCTYPE html")) return [];

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, skipEmptyLines: 'greedy',
        complete: (results) => {
          const rows = results.data as any[][];
          if (!rows || rows.length < 2) { resolve([]); return; }
          
          let tasks = rows.slice(1)
            .filter(row => row && row[0]) // ID_Base
            .map((row, i): MentorshipTask => {
              const idBase = cleanSheetValue(row[0]);
              const subnivel = cleanSheetValue(row[5]);
              const pilar = cleanSheetValue(row[7]);
              const matriz = cleanSheetValue(row[8]);
              const tarea = cleanSheetValue(row[6]);
              
              // Create a stable unique ID based on task content
              const uniqueId = `${idBase}-${subnivel}-${pilar}-${matriz}-${tarea}`.replace(/\s+/g, '_').toLowerCase();

              return {
                id: uniqueId,
                idBase,
                padrino: cleanSheetValue(row[1]),
                codPadrino: cleanSheetValue(row[2]),
                apadrinado: cleanSheetValue(row[3]),
                codApadrinado: cleanSheetValue(row[4]),
                subnivel,
                tarea,
                pilar,
                matriz,
                estado: cleanSheetValue(row[9]),
                fechaCreacion: parseFlexibleDate(row[10]),
                validador: cleanSheetValue(row[11]),
                evidencia: cleanSheetValue(row[12]) // Index 12 is Column M
              };
            });

          if (planId) {
            tasks = tasks.filter(t => t.idBase === planId || planId.indexOf(t.idBase) === 0);
          }
          resolve(tasks);
        },
        error: () => resolve([])
      });
    });
  } catch (e) { return []; }
};

export const submitMentorshipPlanUpdateToSheet = async (data: any): Promise<boolean> => { 
  return await sendToGAS({ method: 'POST_MENTORSHIP_PLAN', data }, GOOGLE_SCRIPT_MENTORSHIP_URL); 
};
export const submitMentorshipTaskEvidenceToSheet = async (data: any): Promise<boolean> => { 
  return await sendToGAS({ method: 'POST_MENTORSHIP_EVIDENCE', data }, GOOGLE_SCRIPT_MENTORSHIP_URL); 
};

export const submitCashlessEvidenceToSheet = async (data: any): Promise<boolean> => {
  return await sendToGAS({ method: 'POST_CASHLESS_EVIDENCE', data }, GOOGLE_SCRIPT_WEB_APP_URL);
};
