"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Folder, Clock, SquarePen, MapPin } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface CompanyTask {
  id: number;
  name: string;
  project: string;
  assignedBy: string;
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);
  const punchedIn = useAppStore((state) => state.punchedIn);
  const punchStartTime = useAppStore((state) => state.punchStartTime);
  const punchHoursToday = useAppStore((state) => state.punchHoursToday);
  const punchHoursWeek = useAppStore((state) => state.punchHoursWeek);
  const togglePunch = useAppStore((state) => state.togglePunch);
  const updateTimesheetHours = useAppStore((state) => state.updateTimesheetHours);
  const { t } = useTranslation();

  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState("");
  const [runningTimer, setRunningTimer] = useState("00:00:00");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Form State for Log Work Details
  const [projectClient, setProjectClient] = useState("Internal Operations");
  const [timeLogged, setTimeLogged] = useState("8 Hours (Full Day)");
  const [workNotes, setWorkNotes] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");

  // Modal State for Punch In/Out Workflow
  const [showPunchInModal, setShowPunchInModal] = useState(false);
  const [showPunchOutModal, setShowPunchOutModal] = useState(false);
  const [tempProjectClient, setTempProjectClient] = useState("Internal Operations");
  const [tempLocationType, setTempLocationType] = useState<"office"|"home"|"site">("office");
  const [tempOfficeId, setTempOfficeId] = useState("");
  const [tempSiteAddress, setTempSiteAddress] = useState("");
  const [tempLat, setTempLat] = useState<number | null>(null);
  const [tempLng, setTempLng] = useState<number | null>(null);
  const [tempWorkType, setTempWorkType] = useState<"task"|"other">("task");
  const [tempOtherWork, setTempOtherWork] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [tempWorkNotes, setTempWorkNotes] = useState("");
  const [tempTaskCompleted, setTempTaskCompleted] = useState(false);
  const [punchSessions, setPunchSessions] = useState<any[]>([]);

  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [taskHours, setTaskHours] = useState<Record<number, string>>({});
  const [sessionRecord, setSessionRecord] = useState({
    visible: false,
    task: "",
    location: "",
    startTime: "",
    endTime: "",
    remarks: "",
    status: ""
  });
  
  const [showPreviousLogs, setShowPreviousLogs] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [showAllUsersLogs, setShowAllUsersLogs] = useState(false);
  const [allPunchSessions, setAllPunchSessions] = useState<any[]>([]);

  const [selectedCalendarUser, setSelectedCalendarUser] = useState<string>("");

  useEffect(() => {
    if (user && !selectedCalendarUser) {
      setSelectedCalendarUser(user.id);
    }
  }, [user, selectedCalendarUser]);

  const calendarDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, []);

  const getHoursForDate = (date: Date, consultantId: string) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${yyyy}-${mm}-${dd}`;
    
    let totalHours = 0;
    
    if (data.timesheets) {
      data.timesheets.forEach((ts: any) => {
        if (ts.consultant !== consultantId) return;
        
        ts.entries?.forEach((e: any) => {
          if (!e.punchInTime) {
            // Manual entry
            const weekStart = new Date(ts.week);
            weekStart.setDate(weekStart.getDate() + (e.day || 0));
            const wStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
            if (wStr === targetDateStr) {
              totalHours += (e.hours || 0);
            }
          }
        });
      });
    }

    punchSessions.forEach((s: any) => {
      const sConsultantId = s.consultantId || s.consultant;
      if (sConsultantId === consultantId && s.date === targetDateStr && s.punchOut) {
        const diffMs = new Date(s.punchOut).getTime() - new Date(s.punchIn).getTime();
        totalHours += parseFloat((diffMs / 3600000).toFixed(2));
      }
    });
    
    return totalHours;
  };

  const allTasks = useMemo(() => {
    const tasksObj = data.tasks as any;
    if (!tasksObj) return [];
    return [
      ...(tasksObj.todo || []),
      ...(tasksObj.inprogress || []),
      ...(tasksObj.review || []),
      ...(tasksObj.done || []),
    ];
  }, [data.tasks]);

  useEffect(() => {
    const userTasks = allTasks.filter((t: any) => t.assignee === user?.id || t.assigneeId === user?.id);
    if (userTasks.length > 0 && (projectClient === "Internal Operations" || !projectClient)) {
      setProjectClient(userTasks[0].title);
      setTempProjectClient(userTasks[0].title);
    } else if (allTasks.length > 0 && userTasks.length === 0 && (projectClient === "Internal Operations" || !projectClient)) {
      setProjectClient("Internal Operations");
      setTempProjectClient("Internal Operations");
    }
  }, [allTasks, projectClient, user]);


  // Helper to format duration
  const formatDurationText = (ms: number) => {
    const diffSecs = Math.floor(ms / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);
    const seconds = diffSecs % 60;
    
    if (hours > 0) return `${hours} Hour${hours > 1 ? 's' : ''} ${minutes} Minute${minutes !== 1 ? 's' : ''} ${seconds} Second${seconds !== 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} Minute${minutes !== 1 ? 's' : ''} ${seconds} Second${seconds !== 1 ? 's' : ''}`;
    return `${seconds} Second${seconds !== 1 ? 's' : ''}`;
  };

  const handlePunchAction = () => {
    if (!punchedIn) {
      setTempProjectClient(projectClient); // default to current
      setTempLocationType("office");
      setTempOfficeId(data.offices && data.offices.length > 0 ? data.offices[0].id : "");
      setTempSiteAddress("");
      setTempWorkType("task");
      setTempOtherWork("");
      setShowPunchInModal(true);
    } else {
      setTempWorkNotes("");
      setShowPunchOutModal(true);
    }
  };

  const submitPunchIn = async () => {
    setProjectClient(tempWorkType === "task" ? tempProjectClient : "Other Work");
    const loc = tempLocationType === "office" ? (data.offices?.find(o=>o.id===tempOfficeId)?.name || "Office") : (tempLocationType === "home" ? "Home" : tempSiteAddress);
    setCurrentLocation(loc);
    setTimeLogged("Work In Progress");
    setWorkNotes("");
    
    setShowPunchInModal(false);

    try {
      const res = await fetch('/api/timesheets/punch-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: tempWorkType === "task" ? tempProjectClient : "Other Work",
          task: tempWorkType === "task" ? tempProjectClient : "",
          workNotes: tempWorkType === "other" ? tempOtherWork : "",
          location: tempLocationType === "office" ? (data.offices?.find(o=>o.id===tempOfficeId)?.name || "Office") : (tempLocationType === "home" ? "Home" : tempSiteAddress),
          locationType: tempLocationType,
          officeId: tempLocationType === "office" ? tempOfficeId : null,
          siteAddress: tempLocationType === "site" ? tempSiteAddress : null,
          lat: tempLocationType === "site" ? tempLat : null,
          lng: tempLocationType === "site" ? tempLng : null,
          workType: tempWorkType
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setPunchSessions(prev => [...prev, resData.session]);
        useAppStore.setState({ punchedIn: true, punchStartTime: resData.session.punchIn });
        
        // Synchronize with global store data immediately for AI modules
        const storeData = useAppStore.getState().data;
        const userTimesheet = storeData.timesheets.find(
          (t) => t.consultant === user?.id && t.week === targetWeekKey
        ) || {
          id: `ts-${Date.now()}`,
          consultant: user?.id,
          week: targetWeekKey,
          entries: []
        };
          const allTasksList = [
            ...(storeData.tasks.todo || []),
            ...(storeData.tasks.inprogress || []),
            ...(storeData.tasks.review || []),
            ...(storeData.tasks.done || []),
          ];
          const taskObj = allTasksList.find((t: any) => t.title === resData.session.project);
          
          const newEntry = {
            id: resData.session.id,
            timesheetId: (userTimesheet as any).id,
            day: new Date(resData.session.date).getDay() === 0 ? 6 : new Date(resData.session.date).getDay() - 1,
            project: taskObj ? taskObj.project : "Internal",
            task: resData.session.project,
          hours: 0,
          billable: true,
          punchInTime: resData.session.punchIn,
          punchOutTime: null
        };
        const updatedTimesheet = { ...userTimesheet, entries: [...(userTimesheet as any).entries.filter((e: any) => e.id !== resData.session.id), newEntry] };
        const newTimesheetsArray = storeData.timesheets.filter((t: any) => t.id !== (userTimesheet as any).id).concat(updatedTimesheet as any);
        useAppStore.setState({ data: { ...storeData, timesheets: newTimesheetsArray } });

        setSessionRecord({
          visible: true,
          task: tempWorkType === "task" ? tempProjectClient : "Other Work",
          location: tempLocationType === "office" ? (data.offices?.find(o=>o.id===tempOfficeId)?.name || "Office") : (tempLocationType === "home" ? "Home" : tempSiteAddress),
          startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime: "",
          remarks: "",
          status: "In Progress"
        });
      } else {
        showToast("Failed to punch in.", "danger");
      }
    } catch(e) {
      console.error(e);
      showToast("Error punching in.", "danger");
    }
  };

  const submitPunchOut = async () => {
    setShowPunchOutModal(false);
    
    try {
      const res = await fetch('/api/timesheets/punch-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workNotes: tempWorkNotes, isTaskCompleted: tempTaskCompleted })
      });
      const resData = await res.json();
      
      if (resData.success) {
        setPunchSessions(prev => prev.map(s => s.id === resData.session.id ? resData.session : s));
        useAppStore.setState({ punchedIn: false, punchStartTime: null });
        
        if (resData.session.punchIn && resData.session.punchOut) {
          const diffMs = new Date(resData.session.punchOut).getTime() - new Date(resData.session.punchIn).getTime();
          setTimeLogged(formatDurationText(diffMs));
        }

        // Synchronize with global store data immediately for AI modules
        const storeData = useAppStore.getState().data;
        const userTimesheet = storeData.timesheets.find(
          (t) => t.consultant === user?.id && t.week === targetWeekKey
        ) || {
          id: `ts-${Date.now()}`,
          consultant: user?.id,
          week: targetWeekKey,
          entries: []
        };
        const allTasksList = [
          ...(storeData.tasks.todo || []),
          ...(storeData.tasks.inprogress || []),
          ...(storeData.tasks.review || []),
          ...(storeData.tasks.done || []),
        ];
        const taskObj = allTasksList.find((t: any) => t.title === resData.session.project);
        
        const updatedEntry = {
          id: resData.session.id,
          timesheetId: (userTimesheet as any).id,
          day: new Date(resData.session.date).getDay() === 0 ? 6 : new Date(resData.session.date).getDay() - 1,
          project: taskObj ? taskObj.project : "Internal",
          task: resData.session.project,
          hours: resData.session.punchOut ? parseFloat(((new Date(resData.session.punchOut).getTime() - new Date(resData.session.punchIn).getTime()) / 3600000).toFixed(2)) : 0,
          billable: true,
          punchInTime: resData.session.punchIn,
          punchOutTime: resData.session.punchOut
        };
        const updatedTimesheet = { ...userTimesheet, entries: [...(userTimesheet as any).entries.filter((e: any) => e.id !== resData.session.id), updatedEntry] };
        const newTimesheetsArray = storeData.timesheets.filter((t: any) => t.id !== (userTimesheet as any).id).concat(updatedTimesheet as any);
        
        let newTasks = storeData.tasks;
        if (tempTaskCompleted && taskObj) {
          newTasks = { ...storeData.tasks };
          for (const key of Object.keys(newTasks) as Array<keyof typeof newTasks>) {
            newTasks[key] = newTasks[key]?.filter((t: any) => t.id !== taskObj.id) || [];
          }
          newTasks.done = [...(newTasks.done || []), { ...taskObj, progress: 100 }];
        }

        useAppStore.setState({ data: { ...storeData, timesheets: newTimesheetsArray, tasks: newTasks } });
        
        setWorkNotes(tempWorkNotes);
        setSessionRecord(prev => ({
          ...prev,
          endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          remarks: tempWorkNotes,
          status: "Completed"
        }));
      } else {
        showToast("Failed to punch out.", "danger");
      }
    } catch(e) {
      console.error(e);
      showToast("Error punching out.", "danger");
    }
  };

  const handleTaskToggle = (taskId: number) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleHoursChange = (taskId: number, value: string) => {
    setTaskHours((prev) => ({
      ...prev,
      [taskId]: value
    }));
  };

  const handleConfirmTasks = () => {
    showToast("Assigned tasks confirmed successfully.", "success");
  };

  // Dynamically compute assigned tasks from the store data
  const companyAssignedTasks = useMemo(() => {
    if (!user || !data.tasks) return [];
    
    const allTasksList = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
    
    const userTasks = allTasksList.filter((t: any) => t.assignee === user.id || t.assigneeId === user.id);
    
    return userTasks.map((t: any, idx: number) => {
      const projectObj = data.projects.find((p: any) => p.id === (t.project || t.projectId));
      const projectName = projectObj ? projectObj.name : (t.project || t.projectId);
      
      return {
        id: idx + 1,
        taskId: t.id,
        name: t.title,
        project: projectName,
        assignedBy: "Project Manager",
      };
    });
  }, [user, data.tasks, data.projects]);

  // Default timesheet rows generated dynamically from actual projects and tasks
  const DEFAULT_ROWS = useMemo(() => {
    if (!user || !data.projects) return [];
    
    const rows: { project: string; task: string; billable: boolean; defaultHours: number[] }[] = [];
    
    const allTasksList = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
    const userTasks = allTasksList.filter((t: any) => t.assignee === user.id || t.assigneeId === user.id);
    
    data.projects.forEach((proj: any) => {
      const projTasks = userTasks.filter((t: any) => (t.project || t.projectId) === proj.id);
      if (projTasks.length > 0) {
        projTasks.forEach((t: any) => {
          rows.push({
            project: proj.id,
            task: t.title,
            billable: true,
            defaultHours: [0, 0, 0, 0, 0, 0, 0],
          });
        });
      } else {
        rows.push({
          project: proj.id,
          task: "General Project Work",
          billable: true,
          defaultHours: [0, 0, 0, 0, 0, 0, 0],
        });
      }
    });
    
    // Always add an Internal Operations row
    rows.push({
      project: "Internal",
      task: "Team Meeting / Training",
      billable: false,
      defaultHours: [0, 0, 0, 0, 0, 0, 0],
    });
    
    return rows;
  }, [user, data.projects, data.tasks]);

  // 1. Clock effect (digital clock + timer logic)
  useEffect(() => {
    // Current date and time display format
    const formatTime = () => {
      const now = new Date();
      return now.toLocaleTimeString("en-US", { hour12: false });
    };
    setCurrentTime(formatTime());

    const timeInterval = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // 2. Punch session elapsed timer
  useEffect(() => {
    if (punchedIn && punchStartTime) {
      const updateTimer = () => {
        const diffMs = Date.now() - new Date(punchStartTime).getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSecs / 3600);
        const minutes = Math.floor((diffSecs % 3600) / 60);
        const seconds = diffSecs % 60;
        setRunningTimer(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setRunningTimer("00:00:00");
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [punchedIn, punchStartTime]);

  // Weeks definition
  const weekStart = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6 + (weekOffset * 7));
    return start;
  }, [weekOffset]);

  const targetWeekKey = weekStart.toISOString().substring(0, 10);

  // Fetch persisted punch sessions
  useEffect(() => {
    if (!user) return;
    
    const queryParam = selectedCalendarUser ? `?employeeId=${selectedCalendarUser}` : "";
    fetch(`/api/timesheets/punch-sessions${queryParam}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.success) {
          // MOCK REMOVED

          setPunchSessions(resData.sessions);
          
          // Inject fetched sessions directly into the store so AI Center reads them naturally
          const storeData = useAppStore.getState().data;
          const targetUserForTimesheet = selectedCalendarUser || user.id;
          const userTimesheet = storeData.timesheets.find(
            (t) => t.consultant === targetUserForTimesheet && t.week === targetWeekKey
          ) || {
            id: `ts-${Date.now()}`,
            consultant: targetUserForTimesheet,
            week: targetWeekKey,
            entries: []
          };
          
          const allTasksList = [
            ...(storeData.tasks.todo || []),
            ...(storeData.tasks.inprogress || []),
            ...(storeData.tasks.review || []),
            ...(storeData.tasks.done || []),
          ];
          
          const newEntries = resData.sessions.map((s: any) => {
            const taskObj = allTasksList.find((t: any) => t.title === s.project);
            return {
              id: s.id,
              timesheetId: (userTimesheet as any).id,
              day: new Date(s.date).getDay() === 0 ? 6 : new Date(s.date).getDay() - 1, // Approximation for Mon-Sun
              project: taskObj ? taskObj.project : "Internal",
              task: s.project,
            hours: s.punchOut ? parseFloat(((new Date(s.punchOut).getTime() - new Date(s.punchIn).getTime()) / 3600000).toFixed(2)) : 0,
            billable: true,
              punchInTime: s.punchIn,
              punchOutTime: s.punchOut
            };
          });
          
          const oldMockEntries = (userTimesheet as any).entries.filter((e: any) => !e.punchInTime);
          const updatedTimesheet = { ...userTimesheet, entries: [...oldMockEntries, ...newEntries] };
          const newTimesheetsArray = storeData.timesheets.filter((t: any) => t.id !== (userTimesheet as any).id).concat(updatedTimesheet);
          
          useAppStore.setState({ data: { ...storeData, timesheets: newTimesheetsArray } });

          // If viewing current week and it's the logged-in user, restore running timer state safely
          if (weekOffset === 0 && targetUserForTimesheet === user.id) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todaysSessions = resData.sessions.filter((s: any) => s.date === todayStr);
            const activeSession = todaysSessions.find((s: any) => !s.punchOut);
            
            const currentState = useAppStore.getState();
            
            if (activeSession) {
              if (!currentState.punchedIn) {
                useAppStore.setState({ punchedIn: true, punchStartTime: activeSession.punchIn });
              }
              setSessionRecord({
                visible: true,
                task: activeSession.project || "Internal Operations",
                location: activeSession.location || "",
                startTime: new Date(activeSession.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                endTime: "",
                remarks: "",
                status: "In Progress"
              });
              setTimeLogged("Work In Progress");
            } else {
              if (currentState.punchedIn) {
                useAppStore.setState({ punchedIn: false, punchStartTime: null });
              }
              if (todaysSessions.length > 0) {
                // Get the last completed session of the day
                const lastSession = todaysSessions[todaysSessions.length - 1];
                setSessionRecord({
                  visible: true,
                  task: lastSession.project || "Internal Operations",
                  location: lastSession.location || "",
                  startTime: new Date(lastSession.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  endTime: lastSession.punchOut ? new Date(lastSession.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
                  remarks: lastSession.workNotes || "",
                  status: "Completed"
                });
                if (lastSession.punchIn && lastSession.punchOut) {
                  const diffMs = new Date(lastSession.punchOut).getTime() - new Date(lastSession.punchIn).getTime();
                  setTimeLogged(formatDurationText(diffMs));
                }
              } else {
                setSessionRecord({
                  visible: false,
                  task: "",
                  location: "",
                  startTime: "",
                  endTime: "",
                  remarks: "",
                  status: ""
                });
                setTimeLogged("0.0h");
              }
            }
          }
        }
      })
      .catch(console.error);
  }, [weekOffset, user, weekStart, targetWeekKey, selectedCalendarUser]);

  // Fetch all punch sessions if toggled
  useEffect(() => {
    if (showAllUsersLogs && user?.role === "super_admin") {
      const consultants = data.consultants || [];
      Promise.all(
        consultants.map((c: any) =>
          fetch(`/api/timesheets/punch-sessions?employeeId=${c.id}`)
            .then(res => res.json())
            .then(resData => {
              if (resData.success) {
                // Attach consultant info manually since backend might not send it
                // Attach consultant info manually since backend might not send it

                return resData.sessions.map((s: any) => ({
                  ...s,
                  consultant: { name: c.name, role: c.role }
                }));
              }
              return [];
            })
            .catch(() => [])
        )
      ).then(results => {
        const aggregated = results.flat().sort((a: any, b: any) => new Date(a.punchIn).getTime() - new Date(b.punchIn).getTime());
        setAllPunchSessions(aggregated);
      });
    }
  }, [showAllUsersLogs, user, data.consultants]);

  const getWeekRangeLabel = () => {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${t("Week of")} ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const daysLabel = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${t(dayNames[d.getDay()])} ${d.getDate()}`;
  });

  // Retrieve timesheet for current week & user from store
  const userTimesheet = data.timesheets.find(
    (t: any) => t.consultant === (user?.id || "TK") && t.week === targetWeekKey
  );

  // Helper to get hours value for cell from persisted sessions and manual entries
  const getCellHours = (project: string, task: string, day: number, defaultVal: number) => {
    // 1. Check if the user manually entered/modified hours in the store
    if (userTimesheet?.entries) {
      const manualEntry = userTimesheet.entries.find(
        (e: any) => e.project === project && e.task === task && e.day === day && !e.punchInTime
      );
      if (manualEntry && typeof manualEntry.hours === 'number') {
        return manualEntry.hours;
      }
    }

    // 2. Check punch sessions
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + day);
    const dayStr = dayDate.toISOString().split("T")[0];

    // s.project stores the task name (from tempProjectClient during punch in)
    const daySessions = punchSessions.filter(s => s.date === dayStr && (s.project === task || (s.project === "Internal Operations" && task === "Team Meeting / Training")));

    if (daySessions.length > 0) {
      const totalMs = daySessions.reduce((sum, s) => {
        if (!s.punchOut) return sum; // Active sessions do not add to table until punched out
        const diff = new Date(s.punchOut).getTime() - new Date(s.punchIn).getTime();
        return sum + diff;
      }, 0);
      return totalMs > 0 ? parseFloat((totalMs / 3600000).toFixed(2)) : 0;
    }
    
    return weekOffset === 0 ? defaultVal : 0;
  };

  // Build grid data
  const gridRows = DEFAULT_ROWS.map((row) => {
    const hours = Array.from({ length: 7 }, (_, dayIdx) =>
      getCellHours(row.project, row.task, dayIdx, row.defaultHours[dayIdx])
    );
    const total = hours.reduce((a, b) => a + b, 0);
    return {
      ...row,
      hours,
      total,
    };
  });

  // Calculate daily totals
  const dailyTotals = Array.from({ length: 7 }, (_, dayIdx) =>
    gridRows.reduce((sum, r) => sum + r.hours[dayIdx], 0)
  );
  const grandTotal = dailyTotals.reduce((a, b) => a + b, 0);

  // Billable vs non-billable calculations
  const totalBillable = gridRows
    .filter((r) => r.billable)
    .reduce((sum, r) => sum + r.total, 0);
  const totalNonBillable = gridRows
    .filter((r) => !r.billable)
    .reduce((sum, r) => sum + r.total, 0);

  const billableRatio = grandTotal > 0 ? (totalBillable / grandTotal) * 100 : 0;

  const handleHourChange = (project: string, task: string, dayIdx: number, val: string, billable: boolean) => {
    const hours = parseFloat(val);
    if (isNaN(hours) || hours < 0 || hours > 24) return;
    updateTimesheetHours(project, task, dayIdx, hours, billable, targetWeekKey);
    setIsSubmitted(false); // Reset submission status on edits
    showToast("Timesheet entry updated", "success");
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    showToast("Timesheet submitted for approval", "success");
  };

  const handleExport = () => {
    // Generate CSV headers
    const headers = ["Project", "Task", "Billable", ...daysLabel.map(label => label.replace(/\s+/g, " ")), "Total"];
    
    // Generate rows
    const rows = gridRows.map((row) => [
      row.project,
      row.task,
      row.billable ? "Yes" : "No",
      ...row.hours,
      row.total
    ]);
    
    // Add total row at the end
    const totalRow = [
      "Daily Total",
      "",
      "",
      ...dailyTotals,
      grandTotal
    ];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      totalRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    ].join("\n");

    // Create a blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `timesheet_${targetWeekKey}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Timesheet exported successfully", "success");
  };

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });


  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      <style>{`
        .premium-log-card {
          background: var(--bg-page) !important;
          border: none !important;
          border-radius: var(--radius-lg) !important;
          padding: 24px 28px !important;
          box-shadow: none !important;
          position: relative;
          overflow: hidden;
        }
        .premium-select, .premium-input, .premium-textarea {
          border-left: 3px solid #2E86C1 !important;
          transition: all 0.2s ease !important;
          background: var(--bg-surface-2) !important;
        }
        .premium-select:focus, .premium-input:focus, .premium-textarea:focus {
          border-color: #2E86C1 !important;
          box-shadow: 0 0 0 3px rgba(46, 134, 193, 0.15) !important;
        }
        .premium-input::placeholder, .premium-textarea::placeholder {
          color: var(--text-tertiary) !important;
          opacity: 0.8 !important;
        }
        [data-theme="dark"] .premium-input::placeholder,
        [data-theme="dark"] .premium-textarea::placeholder {
          color: rgba(255, 255, 255, 0.45) !important;
          opacity: 1 !important;
        }
        .premium-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .premium-form-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Timesheets")}</h1>
          <p className="page-subtitle">
            {getWeekRangeLabel()} · {user?.name || "Tom Keller"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(weekOffset - 1)}>
            ← {t("Prev Week")}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(weekOffset + 1)}>
            {t("Next Week")} →
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
          >
            {t("Export")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={isSubmitted}
            style={isSubmitted ? { opacity: 0.7, cursor: "not-allowed" } : {}}
          >
            {isSubmitted ? t("Submitted") : t("Submit for Approval")}
          </button>
        </div>
      </div>

      {/* Tabs - Only Weekly Timesheet */}
      <div
        className="tabs mb-4"
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "12px",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          style={{
            padding: "8px 16px",
            fontSize: "13.5px",
            fontWeight: 600,
            border: "none",
            background: "transparent",
            cursor: "default",
            borderBottom: "2px solid #2E86C1",
            color: "#2E86C1",
            transition: "all 0.15s ease",
          }}
        >
          {t("Weekly Timesheet")}
        </button>
      </div>

      <>
          {/* Summary Section */}
          <div className="grid-3-2 mb-4">
            {/* Punch Clock Card */}
            <div className="punch-clock" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div className="punch-status">
                <div
                  className="punch-status-dot"
                  style={{
                    background: punchedIn ? "#10b981" : "#64748b",
                    boxShadow: punchedIn ? "0 0 8px #10b981" : "none",
                    animation: punchedIn ? "pulse 2s infinite" : "none",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {punchedIn ? t("Clocked In") : t("Not Clocked In")}
                </span>
              </div>
              <div className="punch-time" style={{ fontFamily: "monospace", fontSize: "36px", fontWeight: 800 }}>
                {punchedIn ? runningTimer : currentTime}
              </div>
              <div className="punch-date" style={{ fontSize: "12px", opacity: 0.8, marginBottom: "16px" }}>
                {formattedDate}
              </div>
              <button
                className={`punch-btn ${punchedIn ? "punch-out" : "punch-in"}`}
                onClick={handlePunchAction}
                style={{
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  fontWeight: "bold",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {punchedIn ? `⏹ ${t("Punch Out")}` : `▶ ${t("Punch In")}`}
              </button>
            </div>

            {/* Attendance Calendar Card */}
            <div className="card">
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="card-title">{t("Attendance Calendar")}</span>
                {user?.role === "super_admin" && (
                  <SearchableSelect 
                    className="select premium-select" 
                    value={selectedCalendarUser}
                    onChange={(val) => setSelectedCalendarUser(val)}
                    placeholder="Select User"
                    options={data.consultants?.map((c: any) => ({ label: c.name, value: c.id })) || []}
                  />
                )}
              </div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <div key={d} style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", paddingBottom: "8px" }}>{d}</div>
                  ))}
                  {Array.from({ length: (new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {calendarDays.map((date, idx) => {
                    const dayOfWeek = date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isFuture = date > new Date();
                    
                    let bgColor = "var(--bg-surface-2)";
                    let color = "var(--text-primary)";
                    let hours = 0;
                    
                    if (!isFuture) {
                      hours = getHoursForDate(date, selectedCalendarUser);
                    }

                    if (isWeekend) {
                      bgColor = "#FFF9C4"; // Yellow
                      color = "#F5B041";
                    } else if (!isFuture) {
                      if (hours >= 8) {
                        bgColor = "#E8F8F5"; // Green
                        color = "#27AE60";
                      } else if (hours > 5) {
                        bgColor = "#EBF5FB"; // Light Blue
                        color = "#2E86C1";
                      } else {
                        bgColor = "#FDEDEC"; // Red
                        color = "#E74C3C";
                      }
                    }
                    
                    return (
                      <div key={idx} style={{
                        background: bgColor,
                        borderRadius: "4px",
                        padding: "8px 4px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        border: "1px solid var(--border-subtle)"
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color }}>{date.getDate()}</span>
                        {!isFuture && <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{hours.toFixed(1)}h</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Log Details - Session Record */}
          {sessionRecord.visible && (
            <div className="premium-log-card mb-4">
              <div style={{ display: "flex", flexDirection: "column", borderLeft: "3px solid #2E86C1", paddingLeft: "12px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Briefcase size={16} style={{ color: "#2E86C1" }} />
                  <span className="card-title" style={{ fontSize: "16px", fontWeight: 700 }}>
                    {t("Log Work Details")} - {sessionRecord.status}
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  {t("Session record for current task")}
                </span>
              </div>
              <div style={{
                height: "1px",
                background: "linear-gradient(90deg, rgba(46, 134, 193, 0.3) 0%, rgba(46, 134, 193, 0.05) 100%)",
                marginBottom: "20px"
              }} />
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px", color: "var(--text-primary)" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{ fontWeight: 700, minWidth: "120px", color: "#2E86C1" }}>{t("Assigned Task")} :</span>
                  <span>{sessionRecord.task}</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{ fontWeight: 700, minWidth: "120px", color: "#2E86C1" }}>{t("Location")} :</span>
                  <span>{sessionRecord.location || "N/A"}</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{ fontWeight: 700, minWidth: "120px", color: "#2E86C1" }}>{t("Start Time")} :</span>
                  <span>{sessionRecord.startTime}</span>
                </div>
                {sessionRecord.endTime && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontWeight: 700, minWidth: "120px", color: "#2E86C1" }}>{t("End Time")} :</span>
                    <span>{sessionRecord.endTime}</span>
                  </div>
                )}
                {sessionRecord.remarks && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontWeight: 700, minWidth: "120px", color: "#2E86C1" }}>{t("Remarks")} :</span>
                    <span style={{ whiteSpace: "pre-wrap" }}>{sessionRecord.remarks}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Previous Work Logs */}
          <div className="card mb-4" style={{ overflow: "hidden" }}>
            <div 
              className="card-header" 
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} 
              onClick={() => setShowPreviousLogs(!showPreviousLogs)}
            >
              <span className="card-title" style={{ fontSize: "14px" }}>{t("Previous Timesheet Details")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {user?.role === "super_admin" && (
                  <label 
                    style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: "var(--text-secondary)", margin: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="checkbox" 
                      checked={showAllUsersLogs} 
                      onChange={(e) => setShowAllUsersLogs(e.target.checked)} 
                      style={{ margin: 0, cursor: "pointer" }}
                    />
                    {t("View All Users")}
                  </label>
                )}
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {showPreviousLogs ? "▲" : "▼"}
                </span>
              </div>
            </div>
            {showPreviousLogs && (
              <div className="card-body" style={{ padding: "0" }}>
                {(showAllUsersLogs ? allPunchSessions : punchSessions).length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
                    {t("No previous sessions logged.")}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto" }}>
                    {(showAllUsersLogs ? allPunchSessions : punchSessions).slice().reverse().map((s: any, i: number) => {
                      if (!s.punchOut) return null; // Only show completed sessions
                      const inDate = new Date(s.punchIn);
                      const outDate = new Date(s.punchOut);
                      const durationMs = outDate.getTime() - inDate.getTime();
                      const isExpanded = expandedLogs[i] || false;
                      return (
                        <div key={i} style={{ 
                          padding: "12px 16px", 
                          borderBottom: i < (showAllUsersLogs ? allPunchSessions : punchSessions).length - 1 ? "1px solid var(--border-subtle)" : "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                                {s.project || "Internal Operations"}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 6px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-primary)" }}>
                                  {s.consultant?.name || user?.name} <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>({s.consultant?.role || user?.role})</span>
                                </span>
                                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                  {inDate.toLocaleDateString()} · {inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                              <span className="badge badge-success">{formatDurationText(durationMs)}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {s.location && <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{s.location}</span>}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedLogs({ ...expandedLogs, [i]: !isExpanded });
                                  }}
                                  style={{ background: "none", border: "none", color: "#2E86C1", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "0" }}
                                >
                                  {isExpanded ? t("Hide Details") : t("Details")}
                                </button>
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "12px", background: "var(--bg-surface)", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                              <div>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("Work Notes")}:</span>
                                <div style={{ whiteSpace: "pre-wrap", marginTop: "4px" }}>{s.workNotes || t("No notes provided.")}</div>
                              </div>
                              {s.location && (
                                <div>
                                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("Location")}:</span> {s.location}
                                </div>
                              )}
                              <div>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t("Session Duration")}:</span> {s.punchIn && new Date(s.punchIn).toLocaleString()} - {s.punchOut && new Date(s.punchOut).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grid Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <span className="card-title">{t("Weekly Timesheet")}</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="badge badge-brand" style={{ fontSize: "10px" }}>
                  ● {t("Billable")}
                </span>
                <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                  ● {t("Non-Billable")}
                </span>
              </div>
            </div>
            <div style={{ padding: "16px", overflowX: "auto" }}>
              <div className="timesheet-grid" style={{ minWidth: "900px" }}>
                {/* Header row */}
                <div className="timesheet-header">
                  <div className="timesheet-header-cell">{t("Projects")}</div>
                  {daysLabel.map((d) => (
                    <div key={d} className="timesheet-header-cell">
                      {d}
                    </div>
                  ))}
                  <div className="timesheet-header-cell">{t("Total")}</div>
                </div>

                {/* Content rows */}
                {gridRows.map((row, rIdx) => (
                  <div key={rIdx} className="timesheet-row">
                    <div className="timesheet-row-label">
                      <div className="timesheet-row-project" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {data.projects?.find((p: any) => p.id === row.project)?.name || row.project}
                      </div>
                    </div>

                    {row.hours.map((h, dayIdx) => {
                      const cellClass = h > 0 ? (row.billable ? "billable" : "non-billable") : "";
                      return (
                        <div key={dayIdx} className={`timesheet-cell ${cellClass}`}>
                          <input
                            type="number"
                            className="timesheet-hours-input"
                            value={h || ""}
                            onChange={(e) => handleHourChange(row.project, row.task, dayIdx, e.target.value, row.billable)}
                            min="0"
                            max="24"
                            step="0.5"
                            placeholder="—"
                            style={{
                              width: "100%",
                              textAlign: "center",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              fontWeight: h > 0 ? "bold" : "normal",
                            }}
                          />
                        </div>
                      );
                    })}

                    <div className="timesheet-cell" style={{ background: "var(--bg-surface-2)" }}>
                      <span className="timesheet-total" style={{ fontWeight: "bold" }}>
                        {row.total > 0 ? `${row.total.toFixed(1)}h` : "—"}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div className="timesheet-row" style={{ background: "var(--bg-surface-2)" }}>
                  <div className="timesheet-row-label" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("Daily Total")}
                  </div>
                  {dailyTotals.map((t, dayIdx) => (
                    <div key={dayIdx} className="timesheet-cell" style={{ background: "var(--bg-surface-2)" }}>
                      <span className="timesheet-total" style={{ fontWeight: "bold" }}>
                        {t > 0 ? `${t.toFixed(1)}h` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="timesheet-cell" style={{ background: "var(--brand-50)" }}>
                    <span className="timesheet-total" style={{ color: "var(--brand-700)", fontWeight: 800 }}>
                      {grandTotal.toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>


      </>

      {/* Modals for Punch Workflow */}
      {showPunchInModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div className="premium-log-card" style={{ width: "400px", maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", color: "var(--text-primary)" }}>{t("Start Work Session")}</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-secondary)" }}>Work Type</label>
              <div style={{ display: "flex", gap: "8px", padding: "4px", background: "var(--brand-50)", borderRadius: "8px" }}>
                <button
                  className={`btn ${tempWorkType === "task" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1 }}
                  onClick={() => setTempWorkType("task")}
                >
                  Working on Task
                </button>
                <button
                  className={`btn ${tempWorkType === "other" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1 }}
                  onClick={() => setTempWorkType("other")}
                >
                  Other Work
                </button>
              </div>
            </div>

            {tempWorkType === "task" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>{t("Assigned Task")}</label>
                <SearchableSelect
                  className="select premium-select"
                  value={tempProjectClient}
                  onChange={(val) => setTempProjectClient(val)}
                  placeholder="Select Assigned Task"
                  options={allTasks.filter((t: any) => t.assignee === user?.id || t.assigneeId === user?.id).map((task: any) => ({ label: task.title, value: task.title }))}
                />
              </div>
            )}

            {tempWorkType === "other" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>Work Description</label>
                <input
                  type="text"
                  className="input premium-input"
                  placeholder="What are you working on?"
                  value={tempOtherWork}
                  onChange={(e) => setTempOtherWork(e.target.value)}
                  style={{ width: "100%", height: "38px" }}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-secondary)" }}>Work Location</label>
              <div style={{ display: "flex", gap: "4px", padding: "4px", background: "var(--brand-50)", borderRadius: "8px", marginBottom: "8px" }}>
                <button
                  className={`btn ${tempLocationType === "office" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1, padding: "4px 8px", fontSize: "12px" }}
                  onClick={() => setTempLocationType("office")}
                >
                  Office
                </button>
                <button
                  className={`btn ${tempLocationType === "home" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1, padding: "4px 8px", fontSize: "12px" }}
                  onClick={() => setTempLocationType("home")}
                >
                  Home
                </button>
                <button
                  className={`btn ${tempLocationType === "site" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1, padding: "4px 8px", fontSize: "12px" }}
                  onClick={() => setTempLocationType("site")}
                >
                  Site Location
                </button>
              </div>

              {tempLocationType === "office" && (
                <select
                  className="select premium-select"
                  value={tempOfficeId}
                  onChange={(e) => setTempOfficeId(e.target.value)}
                  style={{ width: "100%", height: "38px" }}
                >
                  <option value="" disabled>Select Office</option>
                  {(data.offices || []).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}

              {tempLocationType === "site" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsLocating(true);
                      if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(
                          async (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            setTempLat(lat);
                            setTempLng(lng);
                            // Best effort reverse geocoding via OpenStreetMap (No API key needed)
                            try {
                              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                              const data = await res.json();
                              if (data && data.display_name) {
                                setTempSiteAddress(data.display_name);
                              } else {
                                setTempSiteAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                              }
                            } catch (e) {
                              setTempSiteAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                            }
                            setIsLocating(false);
                          },
                          (error) => {
                            alert("Geolocation failed: " + error.message);
                            setIsLocating(false);
                          }
                        );
                      } else {
                        alert("Geolocation is not supported by your browser.");
                        setIsLocating(false);
                      }
                    }}
                    disabled={isLocating}
                  >
                    {isLocating ? "Locating..." : "Use Current Location"}
                  </button>
                  <input
                    type="text"
                    className="input premium-input"
                    placeholder="Or enter location manually"
                    value={tempSiteAddress}
                    onChange={(e) => setTempSiteAddress(e.target.value)}
                    style={{ width: "100%", height: "38px" }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setShowPunchInModal(false)}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={submitPunchIn}>{t("Start Work")}</button>
            </div>
          </div>
        </div>
      )}

      {showPunchOutModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div className="premium-log-card" style={{ width: "450px", maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "var(--text-primary)" }}>{t("End Work Session")}</h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>{t("Please provide notes on the work completed during this session.")}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>{t("Work Notes / Remarks")}</label>
              <textarea
                className="input premium-textarea"
                rows={4}
                placeholder={t("e.g. Completed API integration for billing dashboard.")}
                value={tempWorkNotes}
                onChange={(e) => setTempWorkNotes(e.target.value)}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>{t("Is this task completed?")}</label>
              <div style={{ display: "flex", gap: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="taskCompleted" 
                    checked={tempTaskCompleted === true} 
                    onChange={() => setTempTaskCompleted(true)} 
                  />
                  Yes, move to Done
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="taskCompleted" 
                    checked={tempTaskCompleted === false} 
                    onChange={() => setTempTaskCompleted(false)} 
                  />
                  No, keep in progress
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setShowPunchOutModal(false)}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={submitPunchOut}>{t("Submit Work")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
