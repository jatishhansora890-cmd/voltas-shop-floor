import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Plus,
  Trash2,
  Save,
  BarChart3,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Settings,
  ToggleLeft,
  ToggleRight,
  Target,
  CalendarDays,
  GitMerge,
  ArrowDown,
  Lock,
  Unlock,
  Pencil,
  Calendar,
  Download,
  FolderPlus,
  RefreshCw,
  Wifi,
  WifiOff,
  History
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

// --- Firebase Config & Init ---
// !!! REPLACE THESE VALUES WITH YOUR REAL KEYS FROM FIREBASE CONSOLE !!!
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'voltas-prod-live';

// --- Constants ---

const AREAS = [
  "CRF",
  "Pre-assembly",
  "Door foaming",
  "Cabinet foaming",
  "CF final",
  "WD final"
];

const PROCESS_FLOW = {
  mainLine: ["Pre-assembly", "Cabinet foaming", "CF final"],
  independent: ["CRF", "Door foaming", "WD final"]
};

// Default Initial Data
const INITIAL_MASTER_DATA = {
  CRF_MACHINES: ["Komatsu Press", "Thermoforming", "Extrusion", "Paint Shop"],
  CRF_PARTS: ["Side Panel", "Back Panel", "Bottom Plate", "Inner Liner", "Door Liner", "Profile"],
  CF_LINE: {
    "Hard Top": ["100L", "200L", "300L", "400L", "500L"],
    "Glass Top": ["200L", "300L", "400L", "500L"]
  },
  WD_LINE: {
    "Standard": ["Floor Standing", "Table Top", "Bottom Loading"]
  }
};

const getDataKeyForArea = (area) => {
  if (area === "CRF") return "CRF";
  if (area === "WD final") return "WD_LINE";
  return "CF_LINE";
};

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, active, colorClass }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
    colorClass ? colorClass : (active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')
  }`}>
    {children}
  </span>
);

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [view, setView] = useState('entry');
 
  // Data State
  const [entries, setEntries] = useState([]);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [activeModels, setActiveModels] = useState({});
  const [monthlyPlans, setMonthlyPlans] = useState({});
  const [dailyPlans, setDailyPlans] = useState({});
 
  // Security State
  const [isPlanUnlocked, setIsPlanUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Entry Form State
  const [activeTab, setActiveTab] = useState(AREAS[0]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [supervisorName, setSupervisorName] = useState('');
 
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
 
  const [currentQty, setCurrentQty] = useState('');
  const [currentBatch, setCurrentBatch] = useState([]);
 
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Settings State
  const [settingsGroup, setSettingsGroup] = useState('CF_LINE');
  const [newItemName, setNewItemName] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [targetCategoryForModel, setTargetCategoryForModel] = useState('');

  // Report State
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportArea, setReportArea] = useState(AREAS[0]);
  const [reportType, setReportType] = useState('daily');
  const [reportModel, setReportModel] = useState('');
  const [productionTimeframe, setProductionTimeframe] = useState('daily');
 
  // Plan Report State
  const [planReportMode, setPlanReportMode] = useState('monthly');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().split('T')[0]);
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().split('T')[0]);

  // Plan Edit Screen State
  const [planMode, setPlanMode] = useState('daily');
  const [planMonth, setPlanMonth] = useState(new Date().toISOString().slice(0, 7));
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [tempPlanData, setTempPlanData] = useState({});

  // --- Firebase Effects ---

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Auth Error", e);
        setDbStatus('error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setDbStatus('connected');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'production_entries');
    const unsubEntries = onSnapshot(entriesRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setEntries(data);
    }, (err) => console.error("Entries Sync Error", err));

    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_settings');
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (doc.id === 'masterData') setMasterData(prev => ({...INITIAL_MASTER_DATA, ...d.data}));
            if (doc.id === 'activeModels') setActiveModels(d.data || {});
            if (doc.id === 'monthlyPlans') setMonthlyPlans(d.data || {});
            if (doc.id === 'dailyPlans') setDailyPlans(d.data || {});
        });
    }, (err) => console.error("Settings Sync Error", err));

    return () => {
        unsubEntries();
        unsubSettings();
    };
  }, [user]);

  // --- Handlers ---

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUnlockPlan = () => {
    if (passwordInput === '1234') {
      setIsPlanUnlocked(true);
      setPasswordInput('');
      showNotification("Plan Editing Unlocked");
    } else {
      showNotification("Incorrect Password");
    }
  };

  const updateSettingsDoc = async (docId, newData) => {
      if (!user) return;
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', docId);
      await setDoc(ref, { data: newData }, { merge: true });
  };

  const toggleModelStatus = async (model) => {
      const newStatus = { ...activeModels, [model]: !activeModels[model] };
      setActiveModels(newStatus);
      await updateSettingsDoc('activeModels', newStatus);
  };

  // --- Settings Logic ---
  const handleSettingsAddCategory = async () => {
    if (!newCategoryInput) return;
    if (masterData.CF_LINE[newCategoryInput]) { showNotification("Category already exists"); return; }
    const newMasterData = { ...masterData, CF_LINE: { ...masterData.CF_LINE, [newCategoryInput]: [] } };
    setMasterData(newMasterData); setNewCategoryInput(''); await updateSettingsDoc('masterData', newMasterData); showNotification("Category Created");
  };

  const handleSettingsAddItem = async () => {
    if (!newItemName) return;
    let newMasterData = { ...masterData };
    let newActiveModels = { ...activeModels, [newItemName]: true };
    if (settingsGroup === 'CRF_MACHINES') newMasterData.CRF_MACHINES = [...newMasterData.CRF_MACHINES, newItemName];
    else if (settingsGroup === 'CRF_PARTS') newMasterData.CRF_PARTS = [...newMasterData.CRF_PARTS, newItemName];
    else if (settingsGroup === 'CF_LINE') {
        if(!targetCategoryForModel) { showNotification("Select Category"); return; }
        newMasterData.CF_LINE[targetCategoryForModel] = [...newMasterData.CF_LINE[targetCategoryForModel], newItemName];
    } else if (settingsGroup === 'WD_LINE') newMasterData.WD_LINE["Standard"] = [...newMasterData.WD_LINE["Standard"], newItemName];
    setMasterData(newMasterData); setActiveModels(newActiveModels); setNewItemName('');
    await updateSettingsDoc('masterData', newMasterData); await updateSettingsDoc('activeModels', newActiveModels); showNotification(`Item Added`);
  };

  const handleSettingsDeleteCategory = async (categoryName) => {
      if(!confirm(`Delete Category "${categoryName}"?`)) return;
      const newCFLine = { ...masterData.CF_LINE }; delete newCFLine[categoryName];
      const newMasterData = { ...masterData, CF_LINE: newCFLine };
      setMasterData(newMasterData); await updateSettingsDoc('masterData', newMasterData); showNotification("Category Deleted");
  };

  const handleSettingsDeleteItem = async (group, item, category = null) => {
    if (!confirm(`Delete ${item}?`)) return;
    let newMasterData = { ...masterData };
    if (group === 'CRF_MACHINES') newMasterData.CRF_MACHINES = newMasterData.CRF_MACHINES.filter(i => i !== item);
    else if (group === 'CRF_PARTS') newMasterData.CRF_PARTS = newMasterData.CRF_PARTS.filter(i => i !== item);
    else if (group === 'CF_LINE' && category) newMasterData.CF_LINE[category] = newMasterData.CF_LINE[category].filter(i => i !== item);
    else if (group === 'WD_LINE') newMasterData.WD_LINE["Standard"] = (newMasterData.WD_LINE["Standard"] || []).filter(i => i !== item);
    setMasterData(newMasterData); await updateSettingsDoc('masterData', newMasterData); showNotification("Deleted");
  };

  // --- Production Logic ---
  const handleAddBatchItem = () => {
    const isCRF = activeTab === 'CRF';
    const isWD = getDataKeyForArea(activeTab) === 'WD_LINE';
    if (!currentQty || parseInt(currentQty) <= 0) return;
    if (isCRF && (!selectedCategory || !selectedSubCategory || !selectedModel)) return;
    if (!isCRF && !selectedModel) return;

    let newItem = {
        id: Date.now(),
        qty: parseInt(currentQty),
        machine: isCRF ? selectedCategory : null,
        part: isCRF ? selectedSubCategory : null,
        model: selectedModel,
        category: !isCRF ? (isWD ? "Standard" : selectedCategory) : null
    };
    setCurrentBatch([...currentBatch, newItem]);
    if(isCRF) { setSelectedSubCategory(''); setSelectedModel(''); } else { setSelectedModel(''); }
    setCurrentQty('');
  };

  const removeBatchItem = (id) => setCurrentBatch(currentBatch.filter(item => item.id !== id));

  const handleSubmitProduction = async () => {
    if (!supervisorName || currentBatch.length === 0) return;
    if (!user) { showNotification("Offline"); return; }

    const payload = {
        timestamp: Date.now(),
        date: entryDate,
        area: activeTab,
        supervisor: supervisorName,
        items: currentBatch
    };

    try {
        if (editingId) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', editingId);
            await updateDoc(docRef, payload);
            showNotification("Entry Updated Successfully!");
            setEditingId(null);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'production_entries'), payload);
            showNotification("Production Submitted!");
        }
        setCurrentBatch([]);
    } catch (e) {
        console.error(e);
        showNotification("Error Saving Data");
    }
  };

  const handleEditEntry = (entry) => {
      setEntryDate(entry.date);
      setSupervisorName(entry.supervisor);
      setCurrentBatch(entry.items);
      setEditingId(entry.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showNotification("Loaded entry for editing");
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setCurrentBatch([]);
      setSupervisorName('');
  };

  const handleDeleteEntry = async (id) => {
      if(!confirm("Are you sure you want to permanently delete this entry?")) return;
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', id));
          showNotification("Entry Deleted");
      } catch(e) {
          showNotification("Error Deleting");
      }
  };

  const handleSavePlan = async () => {
    if (!user) return;
    if (planMode === 'monthly') {
      const newPlans = { ...monthlyPlans, [planMonth]: tempPlanData };
      setMonthlyPlans(newPlans); await updateSettingsDoc('monthlyPlans', newPlans); showNotification("Monthly Budget Saved!");
    } else {
      const newPlans = { ...dailyPlans, [planDate]: tempPlanData };
      setDailyPlans(newPlans); await updateSettingsDoc('dailyPlans', newPlans); showNotification(`Plan for ${planDate} Saved!`);
    }
  };

  const handlePlanInputChange = (model, value) => setTempPlanData(prev => ({ ...prev, [model]: parseInt(value) || 0 }));

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) { showNotification("No data"); return; }
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(','), ...data.map(row => headers.map(fieldName => { let val = row[fieldName]; if (typeof val === 'string' && val.includes(',')) val = `"${val}"`; return val; }).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', `${filename}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- Reports Data ---
  const productionReportData = useMemo(() => {
    const isMonthly = productionTimeframe === 'monthly';
    const filterFn = (entry) => entry.area === reportArea && (isMonthly ? entry.date.startsWith(reportMonth) : entry.date === reportDate);
    const filtered = entries.filter(filterFn);
    const isCRF = reportArea === 'CRF';
    const isDoorFoaming = reportArea === 'Door foaming';
    const plan = isMonthly ? (monthlyPlans[reportMonth] || {}) : (dailyPlans[reportDate] || {});

    if (isCRF) {
        const rows = [];
        filtered.forEach(record => {
            record.items.forEach(item => {
                let existing = rows.find(r => r.machine === item.machine && r.part === item.part && r.model === item.model);
                if (!existing) { existing = { machine: item.machine, part: item.part, model: item.model, actual: 0 }; rows.push(existing); }
                existing.actual += item.qty;
            });
        });
        return { rows: rows.sort((a,b) => b.actual - a.actual), totalActual: rows.reduce((s, r) => s + r.actual, 0) };
    } else {
        const actuals = {};
        let totalActual = 0;
        filtered.forEach(record => {
            record.items.forEach(item => {
                if (!actuals[item.model]) actuals[item.model] = 0;
                actuals[item.model] += item.qty;
                totalActual += item.qty;
            });
        });
        const comparison = [];
        const relevantDataKey = getDataKeyForArea(reportArea);
       
        let relevantModels = [];
        if (masterData[relevantDataKey]) {
            const allModels = Object.values(masterData[relevantDataKey]).flat();
            relevantModels = [...new Set(allModels)];
        }
       
        relevantModels.forEach(model => {
             if (activeModels[model] !== false || plan[model] || actuals[model]) {
                const basePlan = plan[model] || 0;
                const p = isDoorFoaming ? basePlan * 2 : basePlan;
                const a = actuals[model] || 0;
                comparison.push({ model, plan: p, actual: a, percent: p > 0 ? Math.round((a / p) * 100) : (a > 0 ? 100 : 0) });
             }
        });
        return { rows: comparison.sort((a, b) => b.actual - a.actual), totalActual };
    }
  }, [entries, dailyPlans, monthlyPlans, reportDate, reportMonth, reportArea, productionTimeframe, activeModels, masterData]);

  const handleEditPlanFromReport = (mode, dateKey) => {
    if (mode === 'monthly') { setPlanMode('monthly'); setPlanMonth(dateKey); }
    else { setPlanMode('daily'); setPlanDate(dateKey); }
    setIsPlanUnlocked(true);
    setView('plan');
  };

  const processFlowData = useMemo(() => {
    const planData = dailyPlans[reportDate] || {}; const dayEntries = entries.filter(e => e.date === reportDate); const cfModels = masterData.CF_LINE ? Object.values(masterData.CF_LINE).flat() : []; const targetModels = reportModel ? [reportModel] : cfModels;
    let totalPlan = 0; targetModels.forEach(m => { if (planData[m]) totalPlan += planData[m]; });
    const areaActuals = {}; AREAS.forEach(area => areaActuals[area] = 0);
    dayEntries.forEach(entry => { if (entry.area === 'CRF') return; entry.items.forEach(item => { if (!reportModel || item.model === reportModel) areaActuals[entry.area] += item.qty; }); });
    return { totalPlan, areaActuals };
  }, [dailyPlans, entries, reportDate, reportModel, masterData]);

  const planReportData = useMemo(() => {
    let data = []; const allModels = new Set();
    Object.values(masterData).forEach(group => { if(Array.isArray(group)) return; Object.values(group).forEach(arr => arr.forEach(m => allModels.add(m))) });
    if (planReportMode === 'monthly') {
      const plan = monthlyPlans[reportMonth] || {}; Array.from(allModels).forEach(model => { if (plan[model]) data.push({ model, qty: plan[model] }); });
      return { modelAggregates: data.sort((a,b) => b.qty - a.qty) };
    } else {
      const start = new Date(rangeStart); const end = new Date(rangeEnd); const dates = [];
      for(let d = start; d <= end; d.setDate(d.getDate() + 1)) dates.push(new Date(d).toISOString().split('T')[0]);
      const modelTotals = {}; dates.forEach(date => { const dayPlan = dailyPlans[date] || {}; Object.entries(dayPlan).forEach(([model, qty]) => { modelTotals[model] = (modelTotals[model] || 0) + qty; }); });
      data = Object.entries(modelTotals).map(([model, qty]) => ({ model, qty }));
      const dailyBreakdown = dates.map(date => { const dayPlan = dailyPlans[date] || {}; const total = Object.values(dayPlan).reduce((a, b) => a + b, 0); return { date, total }; });
      return { modelAggregates: data.sort((a,b) => b.qty - a.qty), dailyBreakdown };
    }
  }, [planReportMode, reportMonth, rangeStart, rangeEnd, monthlyPlans, dailyPlans, masterData]);

  // --- Renderers ---

  const renderHeader = () => (
    <header className="bg-blue-700 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex flex-col"><h1 className="text-xl font-bold tracking-tight">Voltas Production</h1><span className="text-xs text-blue-200">Vadodara Plant Operations</span></div>
        <div className="flex gap-2 items-center">
          {dbStatus === 'connected' ? <Wifi size={16} className="text-green-300"/> : <WifiOff size={16} className="text-red-300"/>}
          {['entry', 'report', 'plan', 'settings'].map(m => (
            <button key={m} onClick={() => setView(m)} className={`p-2 rounded-full transition-all ${view === m ? 'bg-white text-blue-700' : 'bg-blue-600 text-blue-100'}`}>
              {m === 'entry' && <PenTool size={18} />}{m === 'report' && <BarChart3 size={18} />}{m === 'plan' && (isPlanUnlocked ? <Unlock size={18} /> : <Lock size={18} />)}{m === 'settings' && <Settings size={18} />}
            </button>
          ))}
        </div>
      </div>
    </header>
  );

  const renderEntryScreen = () => {
    const isCRF = activeTab === 'CRF';
    const isWD = getDataKeyForArea(activeTab) === 'WD_LINE';
    const primaryOptions = isCRF ? masterData.CRF_MACHINES : (isWD ? [] : Object.keys(masterData.CF_LINE));
    const secondaryOptions = isCRF ? masterData.CRF_PARTS : [];
    let modelOptions = [];
    if (isCRF) modelOptions = Object.values(masterData.CF_LINE).flat();
    else if (isWD) modelOptions = masterData.WD_LINE["Standard"];
    else if (selectedCategory) modelOptions = masterData.CF_LINE[selectedCategory] || [];
    const filterActive = (list) => list.filter(item => activeModels[item] !== false);
    const filteredPrimary = isCRF ? filterActive(primaryOptions) : primaryOptions;
    const filteredSecondary = filterActive(secondaryOptions);
    const filteredModels = filterActive(modelOptions);

    const recentEntries = entries.filter(e => e.date === entryDate && e.area === activeTab);

    return (
      <div className="space-y-4 pb-24">
        <div className="bg-white shadow-sm sticky top-[72px] z-40 overflow-x-auto no-scrollbar border-b border-gray-100">
          <div className="flex p-2 gap-2 min-w-max">{AREAS.map(area => (<button key={area} onClick={() => { setActiveTab(area); setSelectedCategory(''); setSelectedSubCategory(''); setSelectedModel(''); }} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === area ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>{area}</button>))}</div>
        </div>
        <div className="px-4 space-y-4 max-w-md mx-auto mt-4">
          <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Date</label>
                      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full p-2 border rounded text-sm mb-2" />
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supervisor Name</label>
                      <div className="flex items-center gap-2"><User size={18} className="text-gray-400" /><input type="text" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="Enter your name" className="w-full outline-none text-gray-800 font-medium placeholder-gray-300" /></div>
                  </div>
              </div>
          </Card>
         
          <Card className={`p-4 space-y-4 ${editingId ? 'border-2 border-orange-300 bg-orange-50' : ''}`}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    {editingId ? <><Pencil size={16} className="text-orange-600"/> Edit Mode</> : 'Add Production'}
                </h3>
                {editingId && <button onClick={handleCancelEdit} className="text-xs text-red-500 font-bold border border-red-200 px-2 py-1 rounded bg-white">Cancel Edit</button>}
                {!editingId && <Badge active>{activeTab}</Badge>}
            </div>
           
            <div className="grid grid-cols-1 gap-3">
              {!isWD && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">{isCRF ? 'Select Machine' : 'Product Category'}</label><div className="relative"><select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); if(!isCRF) setSelectedModel(''); }} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select...</option>{filteredPrimary.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              {isCRF && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">Select Part</label><div className="relative"><select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Part...</option>{filteredSecondary.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              {(selectedCategory || isWD || isCRF) && (<div className="animate-in fade-in slide-in-from-top-2 duration-300"><label className="text-xs text-gray-500 font-semibold mb-1 block">{isCRF ? 'For Model (Target)' : 'Model (Capacity)'}</label><div className="relative"><select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Model</option>{filteredModels.map(model => <option key={model} value={model}>{model}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              <div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs text-gray-500 font-semibold mb-1 block">Quantity</label><input type="number" value={currentQty} onChange={(e) => setCurrentQty(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500" /></div><button onClick={handleAddBatchItem} className="bg-blue-600 text-white p-3 rounded-lg font-medium flex items-center gap-2"><Plus size={20} /> Add</button></div>
            </div>
          </Card>

          {currentBatch.length > 0 && (<div className="space-y-2 animate-in fade-in slide-in-from-bottom-4"><h3 className="text-sm font-semibold text-gray-500 ml-1">Entries to {editingId ? 'Update' : 'Submit'}</h3>{currentBatch.map((item) => (<div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm"><div>{isCRF ? (<><div className="font-bold text-gray-800">{item.part}</div><div className="text-xs text-gray-500">{item.machine} | For: {item.model}</div></>) : (<><div className="font-bold text-gray-800">{item.model}</div>{!isWD && <div className="text-xs text-gray-500">{item.category}</div>}</>)}</div><div className="flex items-center gap-4"><span className="text-lg font-bold text-blue-600">{item.qty}</span><button onClick={() => removeBatchItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button></div></div>))}</div>)}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-50"><div className="max-w-md mx-auto"><button onClick={handleSubmitProduction} disabled={!supervisorName || currentBatch.length === 0} className={`w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg text-white disabled:bg-gray-200 disabled:text-gray-400 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{(!supervisorName || currentBatch.length === 0) ? <><AlertCircle size={20} /> Complete Details</> : (editingId ? <><RefreshCw size={20} /> Update Entry</> : <><Save size={20} /> Submit Production</>)}</button></div></div>
         
          {recentEntries.length > 0 && (
              <div className="mt-8 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><History size={16} /> Recent Submissions ({entryDate})</h3>
                  <div className="space-y-3">
                      {recentEntries.map(entry => (
                          <div key={entry.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                  <div><span className="font-bold text-gray-800 block">{entry.supervisor}</span><span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                  <div className="flex gap-2"><button onClick={() => handleEditEntry(entry)} className="p-1.5 bg-white border border-gray-200 rounded text-blue-600 shadow-sm"><Pencil size={14} /></button><button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 bg-white border border-gray-200 rounded text-red-500 shadow-sm"><Trash2 size={14} /></button></div>
                              </div>
                              <div className="space-y-1">
                                  {entry.items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs text-gray-600 border-b border-gray-200 last:border-0 pb-1 last:pb-0"><span>{isCRF ? `${item.part} (${item.model})` : item.model}</span><span className="font-bold">{item.qty}</span></div>))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
      </div>
    );
  };

  const renderReportScreen = () => {
    const isCRF = reportArea === 'CRF';
    return (
    <div className="p-4 max-w-md mx-auto space-y-6 pb-20">
      <div className="flex bg-gray-200 p-1 rounded-lg"><button onClick={() => setReportType('flow')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${reportType === 'flow' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}>Process Flow</button><button onClick={() => setReportType('daily')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${reportType === 'daily' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}>Production</button><button onClick={() => setReportType('plan')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${reportType === 'plan' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}>Plan Status</button></div>
     
      {reportType === 'flow' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           <Card className="p-4 bg-white border border-gray-200">
            <div className="flex justify-between items-start mb-2"><h3 className="text-xs font-bold text-gray-400 uppercase">Flow Configuration</h3><button onClick={() => { const rows = PROCESS_FLOW.mainLine.map((area, idx) => { const actual = processFlowData.areaActuals[area]; const bal = processFlowData.totalPlan - actual; const prev = idx > 0 ? PROCESS_FLOW.mainLine[idx-1] : null; const wip = prev ? (processFlowData.areaActuals[prev] - actual) : 0; return { Area: area, Plan: processFlowData.totalPlan, Actual: actual, Balance: bal, WIP_Stock: wip }; }); exportToCSV(rows, `Process_Flow_${reportDate}`); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export</button></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-gray-500 mb-1 block">Date</label><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div><div><label className="text-xs font-bold text-gray-500 mb-1 block">Model Filter</label><select value={reportModel} onChange={(e) => setReportModel(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm bg-white"><option value="">All Models</option>{(masterData.CF_LINE ? Object.values(masterData.CF_LINE).flat().sort() : []).map(m => <option key={m} value={m}>{m}</option>)}</select></div></div>
          </Card>
          <div className="space-y-0">
             <div className="flex items-center gap-2 mb-2 px-1"><GitMerge size={18} className="text-blue-600"/><h3 className="font-bold text-gray-700">Line Status</h3></div>
             <div className="bg-blue-100 p-3 rounded-t-xl border border-blue-200 text-center"><div className="text-xs font-bold text-blue-600 uppercase">{reportModel ? `Plan (${reportModel})` : 'Total Plan'}</div><div className="text-2xl font-bold text-blue-800">{processFlowData.totalPlan}</div></div>
             <div className="bg-white border-x border-b border-gray-200 rounded-b-xl p-4 space-y-2">{PROCESS_FLOW.mainLine.map((area, index) => { const actual = processFlowData.areaActuals[area]; const balanceToPlan = processFlowData.totalPlan - actual; const prevArea = index > 0 ? PROCESS_FLOW.mainLine[index - 1] : null; const wip = prevArea ? (processFlowData.areaActuals[prevArea] - actual) : 0; return (<div key={area}>{index > 0 && (<div className="flex items-center justify-center py-2 relative"><ArrowDown size={20} className="text-gray-300" />{wip > 0 ? (<span className="absolute left-[60%] text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">WIP: {wip}</span>) : (wip < 0 && <span className="absolute left-[60%] text-[10px] text-red-400">Error</span>)}</div>)}<div className={`p-3 rounded-lg border flex justify-between items-center ${area === 'CF final' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}><div><div className="font-bold text-gray-800 text-sm">{area}</div></div><div className="flex gap-4 text-right"><div><div className="text-[10px] text-gray-400 uppercase">Act</div><div className="font-bold text-gray-900 text-lg">{actual}</div></div><div className="w-px bg-gray-200"></div><div><div className="text-[10px] text-red-400 uppercase">Bal</div><div className="font-bold text-red-600 text-lg">{balanceToPlan}</div></div></div></div></div>); })}</div>
          </div>
        </div>
      )}

      {reportType === 'daily' && (
        <div className="space-y-4">
           <div className="flex gap-2 mb-2"><button onClick={() => setProductionTimeframe('daily')} className={`flex-1 py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1 ${productionTimeframe === 'daily' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}><CalendarDays size={14}/> Daily Report</button><button onClick={() => setProductionTimeframe('monthly')} className={`flex-1 py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1 ${productionTimeframe === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}><Calendar size={14}/> Monthly Report</button></div>
          <Card className="p-4 space-y-4 bg-white border border-gray-200">
             <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span className="text-xs font-bold text-gray-400 uppercase">Filter & Export</span><button onClick={() => { const data = productionReportData.rows; const filename = `${productionTimeframe}_Production_${productionTimeframe === 'daily' ? reportDate : reportMonth}`; let cleanData; if (isCRF) { cleanData = data.map(r => ({ Machine: r.machine, Part: r.part, Model: r.model, Qty: r.actual })); } else { cleanData = data.map(r => ({ Model: r.model, Plan: r.plan, Actual: r.actual, Achievement_Percent: r.percent + '%' })); } exportToCSV(cleanData, filename); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export Excel</button></div>
            <div className="grid grid-cols-2 gap-3">{productionTimeframe === 'daily' ? (<div><label className="text-xs font-bold text-gray-500 mb-1 block">Date</label><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>) : (<div><label className="text-xs font-bold text-gray-500 mb-1 block">Month</label><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>)}<div><label className="text-xs font-bold text-gray-500 mb-1 block">Area</label><select value={reportArea} onChange={(e) => setReportArea(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm bg-white">{AREAS.map(area => <option key={area} value={area}>{area}</option>)}</select></div></div>
          </Card>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <thead className="bg-gray-50 border-b border-gray-200 w-full block"><tr className="flex w-full">{isCRF ? (<><th className="p-3 text-xs font-bold text-gray-500 uppercase w-1/3 text-left">Part/Machine</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-left">For Model</th><th className="p-3 text-xs font-bold text-gray-500 uppercase w-20 text-right">Qty</th></>) : (<><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-left">Model</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">{productionTimeframe === 'daily' ? 'D.Plan' : 'M.Budget'}</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">Act</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">%</th></>)}</tr></thead>
            <tbody className="divide-y divide-gray-100 block w-full max-h-[400px] overflow-y-auto">{productionReportData.rows.map((row, idx) => (<tr key={idx} className="hover:bg-gray-50 text-sm flex w-full">{isCRF ? (<><td className="p-3 font-medium text-gray-700 w-1/3 text-left"><div className="font-bold">{row.part}</div><div className="text-[10px] text-gray-400">{row.machine}</div></td><td className="p-3 text-gray-600 flex-1 text-left flex items-center">{row.model}</td><td className="p-3 text-right font-bold text-blue-600 w-20">{row.actual}</td></>) : (<><td className="p-3 font-medium text-gray-700 flex-1 text-left">{row.model}</td><td className="p-3 text-right text-gray-400 font-medium flex-1">{row.plan || '-'}</td><td className="p-3 text-right font-bold text-blue-600 flex-1">{row.actual}</td><td className="p-3 text-right flex-1"><span className={`px-2 py-0.5 rounded text-xs font-bold ${row.percent >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.percent}%</span></td></>)}</tr>))}</tbody>
             <div className="bg-blue-50 p-3 flex justify-between items-center border-t border-blue-100"><span className="text-blue-800 font-bold text-sm">Total {isCRF ? 'Parts' : 'Units'}</span><span className="text-blue-800 font-bold text-lg">{productionReportData.totalActual}</span></div>
          </div>
        </div>
      )}
     
      {reportType === 'plan' && (
         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
           <div className="flex gap-2"><button onClick={() => setPlanReportMode('monthly')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${planReportMode === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}>Monthly Budget</button><button onClick={() => setPlanReportMode('range')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${planReportMode === 'range' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}>Date Range</button></div>
           <Card className="p-4 bg-white border border-gray-200">
             <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2"><span className="text-xs font-bold text-gray-400 uppercase">View & Export</span><button onClick={() => { const filename = planReportMode === 'monthly' ? `Budget_${reportMonth}` : `Plan_${rangeStart}_to_${rangeEnd}`; if (planReportMode === 'monthly') { exportToCSV(planReportData.modelAggregates.map(r => ({ Model: r.model, Monthly_Budget: r.qty })), filename); } else { exportToCSV(planReportData.dailyBreakdown.map(d => ({ Date: d.date, Total_Plan_Qty: d.total })), filename + "_Breakdown"); } }} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export</button></div>
             {planReportMode === 'monthly' ? (<div className="flex justify-between items-end"><div className="flex-1 mr-4"><label className="text-xs font-bold text-gray-500 mb-1 block">Select Month</label><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div><button onClick={() => handleEditPlanFromReport('monthly', reportMonth)} className="bg-blue-600 text-white p-2 rounded-lg mb-0.5"><Pencil size={18} /></button></div>) : (<div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-gray-500 mb-1 block">Start Date</label><input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div><div><label className="text-xs font-bold text-gray-500 mb-1 block">End Date</label><input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div></div>)}
           </Card>
           {planReportMode === 'monthly' ? (<div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"><div className="bg-gray-50 p-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Budget Breakdown ({reportMonth})</div>{planReportData.modelAggregates.length > 0 ? (<table className="w-full text-left"><tbody className="divide-y divide-gray-100">{planReportData.modelAggregates.map((row) => (<tr key={row.model} className="text-sm"><td className="p-3 font-medium text-gray-700">{row.model}</td><td className="p-3 text-right font-bold text-gray-900">{row.qty}</td></tr>))}</tbody></table>) : (<div className="p-4 text-center text-sm text-gray-400">No budget set for this month.</div>)}</div>) : (<div className="space-y-4"><div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"><div className="bg-purple-50 p-3 border-b border-purple-100 font-bold text-purple-800 text-sm">Total Plan ({rangeStart} to {rangeEnd})</div>{planReportData.modelAggregates.length > 0 ? (<table className="w-full text-left"><tbody className="divide-y divide-gray-100">{planReportData.modelAggregates.map((row) => (<tr key={row.model} className="text-sm"><td className="p-3 font-medium text-gray-700">{row.model}</td><td className="p-3 text-right font-bold text-gray-900">{row.qty}</td></tr>))}</tbody></table>) : (<div className="p-4 text-center text-sm text-gray-400">No plans found in range.</div>)}</div><div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200"><div className="bg-gray-50 p-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Daily Schedule Breakdown</div><div className="divide-y divide-gray-100">{planReportData.dailyBreakdown.map(day => (<div key={day.date} className="flex items-center justify-between p-3 hover:bg-gray-50"><div><div className="font-medium text-gray-800 text-sm">{day.date}</div></div><div className="flex items-center gap-4"><span className="text-sm font-bold text-gray-600">{day.total} units</span><button onClick={() => handleEditPlanFromReport('daily', day.date)} className="text-blue-600 p-1 bg-blue-50 rounded"><Pencil size={14}/></button></div></div>))}</div></div></div>)}
        </div>
      )}
    </div>
    );
  };

  const renderPlanScreen = () => {
    if (!isPlanUnlocked) {
      return (
        <div className="p-8 max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="bg-blue-100 p-6 rounded-full"><Lock size={48} className="text-blue-600" /></div>
          <div className="text-center"><h2 className="text-xl font-bold text-gray-800">Plan Locked</h2><p className="text-sm text-gray-500 mt-1">Enter PIN to edit targets</p></div>
          <div className="w-full max-w-xs space-y-4"><input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter PIN" className="w-full text-center text-2xl tracking-widest p-3 border rounded-lg focus:border-blue-500 outline-none" maxLength={4} /><button onClick={handleUnlockPlan} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Unlock</button><p className="text-center text-xs text-gray-400">Default PIN: 1234</p></div>
        </div>
      );
    }
    return (
      <div className="p-4 max-w-md mx-auto space-y-6 pb-24">
        <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-bold text-gray-700">Set Targets</h2><button onClick={() => setIsPlanUnlocked(false)} className="text-xs text-red-500 font-bold flex items-center gap-1 border border-red-100 px-2 py-1 rounded bg-red-50"><Lock size={12}/> Lock</button></div>
        <div className="flex bg-gray-200 p-1 rounded-lg"><button onClick={() => setPlanMode('daily')} className={`flex-1 py-2 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-all ${planMode === 'daily' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}><CalendarDays size={16} /> Daily</button><button onClick={() => setPlanMode('monthly')} className={`flex-1 py-2 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-all ${planMode === 'monthly' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}><Target size={16} /> Monthly</button></div>
        <Card className="p-4 bg-blue-50 border-blue-100"><label className="text-xs font-bold text-blue-600 mb-1 block">{planMode === 'monthly' ? 'Select Month' : 'Select Date'}</label>{planMode === 'monthly' ? <input type="month" value={planMonth} onChange={(e) => setPlanMonth(e.target.value)} className="w-full p-2 rounded border border-blue-200 text-sm" /> : <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="w-full p-2 rounded border border-blue-200 text-sm" />}</Card>
        <div className="space-y-4">
           {['CF_LINE', 'WD_LINE'].map(groupKey => {
               const group = masterData[groupKey];
               return Object.entries(group).map(([cat, models]) => (
                   <Card key={cat} className="overflow-hidden mb-3">
                       <div className="bg-gray-50 p-2 border-b border-gray-100 font-bold text-gray-700 text-xs uppercase">{cat}</div>
                       <div className="divide-y divide-gray-100 p-2">
                           {models.map(model => (
                               <div key={model} className="flex items-center justify-between p-2">
                                   <span className="text-sm font-medium text-gray-700">{model}</span>
                                   <input type="number" placeholder="Plan" value={tempPlanData[model] || ''} onChange={(e) => handlePlanInputChange(model, e.target.value)} className="w-20 p-2 text-right border rounded bg-gray-50 focus:bg-white outline-none focus:border-blue-500" />
                               </div>
                           ))}
                       </div>
                   </Card>
               ))
           })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-50"><div className="max-w-md mx-auto"><button onClick={handleSavePlan} className="w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 transition-all"><Save size={20} /> Save Plan</button></div></div>
      </div>
    );
  };

  const renderSettingsScreen = () => {
    return (
     <div className="p-4 max-w-md mx-auto space-y-6 pb-20">
      <div className="bg-white p-4 rounded-xl border-l-4 border-blue-600 shadow-sm"><h2 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={20} className="text-blue-600" /> Plant Configuration</h2></div>
     
      <div className="grid grid-cols-2 gap-2 mb-2">
         <button onClick={() => { setSettingsGroup('CF_LINE'); setTargetCategoryForModel(''); }} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'CF_LINE' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Assembly Models</button>
         <button onClick={() => { setSettingsGroup('WD_LINE'); setTargetCategoryForModel(''); }} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'WD_LINE' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Water Dispenser</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
         <button onClick={() => setSettingsGroup('CRF_MACHINES')} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'CRF_MACHINES' ? 'bg-blue-600 text-white' : 'bg-white'}`}>CRF Machines</button>
         <button onClick={() => setSettingsGroup('CRF_PARTS')} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'CRF_PARTS' ? 'bg-blue-600 text-white' : 'bg-white'}`}>CRF Parts</button>
      </div>

      {settingsGroup === 'CF_LINE' && (
        <Card className="p-4 bg-orange-50 border-orange-100">
           <label className="text-xs font-bold text-orange-600 mb-2 block uppercase flex items-center gap-1"><FolderPlus size={14}/> Add Product Category</label>
           <div className="flex gap-2">
               <input type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder="e.g. Inverter Series" className="flex-1 p-2 border rounded text-sm bg-white" />
               <button onClick={handleSettingsAddCategory} className="bg-orange-600 text-white px-4 rounded font-bold text-sm"><Plus size={18} /></button>
           </div>
        </Card>
      )}

      <Card className="p-4">
          <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">
              {settingsGroup === 'CRF_MACHINES' ? 'Add Machine' : settingsGroup === 'CRF_PARTS' ? 'Add Part' : 'Add Model'}
          </label>
          <div className="space-y-2">
             {settingsGroup === 'CF_LINE' && (
                 <select value={targetCategoryForModel} onChange={(e) => setTargetCategoryForModel(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">Select Category...</option>
                    {Object.keys(masterData.CF_LINE).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
             )}
             <div className="flex gap-2">
                 <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Name..." className="flex-1 p-2 border rounded text-sm" />
                 <button onClick={handleSettingsAddItem} className="bg-green-600 text-white px-4 rounded font-bold text-sm"><Plus size={18} /></button>
             </div>
          </div>
      </Card>

      <Card className="p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Existing Items</h3>
          <div className="divide-y divide-gray-100">
             
             {/* CRF MACHINES */}
             {settingsGroup === 'CRF_MACHINES' && masterData.CRF_MACHINES.map(m => (
                 <div key={m} className="flex justify-between py-2 text-sm items-center">
                     <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                     <div className="flex gap-3">
                         <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                         <button onClick={() => handleSettingsDeleteItem('CRF_MACHINES', m)} className="text-red-400"><Trash2 size={14}/></button>
                     </div>
                 </div>
             ))}
             
             {/* CRF PARTS */}
             {settingsGroup === 'CRF_PARTS' && masterData.CRF_PARTS.map(m => (
                 <div key={m} className="flex justify-between py-2 text-sm items-center">
                     <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                     <div className="flex gap-3">
                         <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                         <button onClick={() => handleSettingsDeleteItem('CRF_PARTS', m)} className="text-red-400"><Trash2 size={14}/></button>
                     </div>
                 </div>
             ))}
             
             {/* WD LINE */}
             {settingsGroup === 'WD_LINE' && masterData.WD_LINE["Standard"].map(m => (
                 <div key={m} className="flex justify-between py-2 text-sm items-center">
                     <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                     <div className="flex gap-3">
                         <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                         <button onClick={() => handleSettingsDeleteItem('WD_LINE', m)} className="text-red-400"><Trash2 size={14}/></button>
                     </div>
                 </div>
             ))}
             
             {/* CF LINE (Assembly) */}
             {settingsGroup === 'CF_LINE' && Object.keys(masterData.CF_LINE).map(cat => (
                 <div key={cat} className="mb-4">
                     <div className="bg-gray-100 p-2 text-xs font-bold rounded flex justify-between items-center text-gray-700">
                         {cat}
                         <button onClick={() => handleSettingsDeleteCategory(cat)} className="text-red-500 hover:bg-red-100 p-1 rounded" title="Delete Category"><Trash2 size={14}/></button>
                     </div>
                     {masterData.CF_LINE[cat].map(m => (
                        <div key={m} className="flex justify-between py-2 pl-2 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                            <div className="flex gap-3">
                                <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>
                                   {activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                <button onClick={() => handleSettingsDeleteItem('CF_LINE', m, cat)} className="text-red-400"><Trash2 size={14}/></button>
                            </div>
                        </div>
                     ))}
                 </div>
             ))}
          </div>
      </Card>
    </div>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'entry': return renderEntryScreen();
      case 'report': return renderReportScreen();
      case 'plan': return renderPlanScreen();
      case 'settings': return renderSettingsScreen();
      default: return renderEntryScreen();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {renderHeader()}
      <main>{renderContent()}</main>
      {notification && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 z-[60] animate-in fade-in slide-in-from-bottom-4"><CheckCircle2 size={18} /><span className="font-medium text-sm">{notification}</span></div>}
    </div>
  );
}
