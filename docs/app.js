const API_KEY = 'VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV';
let ws = null;
let connectionCode = '';
let isConnected = false;

// DOM Elements
const overlay = document.getElementById('connection-overlay');
const mainApp = document.getElementById('main-app');
const connectBtn = document.getElementById('connect-btn');
const codeInput = document.getElementById('sync-code-input');
const errorText = document.getElementById('connection-error');
const remoteStatus = document.getElementById('remote-status');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

// Timer State
let timerInterval;
let timeRemaining = 25 * 60;
let isTimerRunning = false;
let currentTimerMode = 'FOCUS'; // or 'BREAK'
const timeDisplay = document.getElementById('time-display');
const timerStateLabel = document.getElementById('timer-state-label');
const progressCircle = document.querySelector('.progress-ring__circle');
const circumference = 2 * Math.PI * 130;

// Tasks State
let tasks = [];
const taskList = document.getElementById('task-list');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');

/* Initialize */
function init() {
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    
    connectBtn.addEventListener('click', handleConnect);
    
    codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleConnect();
    });

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const targetId = `view-${item.dataset.target}`;
            views.forEach(view => {
                if (view.id === targetId) {
                    view.classList.add('active');
                    view.classList.remove('hidden');
                } else {
                    view.classList.remove('active');
                    view.classList.add('hidden');
                }
            });
        });
    });

    // Timer Controls
    document.getElementById('timer-start').addEventListener('click', () => {
        if(!isTimerRunning) {
            broadcastEvent('TIMER_START');
            startLocalTimer();
        }
    });

    document.getElementById('timer-stop').addEventListener('click', () => {
        if(isTimerRunning) {
            broadcastEvent('TIMER_PAUSE');
            pauseLocalTimer();
        }
    });

    document.getElementById('timer-reset').addEventListener('click', () => {
        broadcastEvent('TIMER_RESET');
        resetLocalTimer(25 * 60, 'FOCUS');
    });

    // Tasks Controls
    addTaskBtn.addEventListener('click', () => {
        const title = newTaskInput.value.trim();
        if (title) {
            const newTask = {
                id: Date.now().toString(),
                title,
                completed: false,
                priority: 'medium'
            };
            broadcastEvent('TASK_ADD', newTask);
            addTaskLocally(newTask);
            newTaskInput.value = '';
        }
    });
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTaskBtn.click();
    });
}

function handleConnect() {
    const code = codeInput.value;
    if (code.length < 6) {
        errorText.innerText = "Please enter a valid 6-character code.";
        return;
    }
    
    errorText.innerText = "";
    connectBtn.classList.add('loading');
    
    // Setup WebSocket
    ws = new WebSocket('wss://socketsbay.com/wss/v2/1/demo/');
    
    ws.onopen = () => {
        isConnected = true;
        connectionCode = code;
        connectBtn.classList.remove('loading');
        overlay.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        document.getElementById('paired-code-display').innerText = code;
        remoteStatus.innerText = "Secured Link Established";
        
        // Request full state sync from app
        broadcastEvent('REQUEST_FULL_STATE');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && data.__monolith && data.channel === connectionCode) {
                handleRemoteEvent(data.type, data.payload);
            }
        } catch (e) {
            console.error("Parse error", e);
        }
    };
    
    ws.onerror = () => {
        isConnected = false;
        connectBtn.classList.remove('loading');
        errorText.innerText = "Connection failed. Please verify the code and network.";
    };
    
    ws.onclose = () => {
        isConnected = false;
        remoteStatus.innerText = "Disconnected... Reconnecting.";
        document.querySelector('.status-dot').classList.remove('online');
    };
}

function broadcastEvent(type, payload = {}) {
    if (ws && isConnected) {
        ws.send(JSON.stringify({
            __monolith: true,
            channel: connectionCode,
            source: 'WEB',
            type,
            payload
        }));
    }
}

function handleRemoteEvent(type, payload) {
    switch (type) {
        case 'FULL_STATE_SYNC':
            // Overwrite local UI with App's authoritative state
            if (payload.tasks) syncTasks(payload.tasks);
            if (payload.timer) syncTimer(payload.timer);
            if (payload.greeting) document.getElementById('greeting-text').innerText = payload.greeting;
            if (payload.notes) syncNotes(payload.notes);
            break;
            
        case 'TIMER_STATE_UPDATE':
            syncTimer(payload);
            break;
            
        case 'TASK_STATE_UPDATE':
            syncTasks(payload.tasks);
            break;
    }
}

/* Timer Logic */
function syncTimer(data) {
    if (data.isRunning !== isTimerRunning) {
        if (data.isRunning) startLocalTimer();
        else pauseLocalTimer();
    }
    timeRemaining = data.timeRemaining;
    currentTimerMode = data.mode || 'FOCUS';
    updateTimerDisplay();
}

function startLocalTimer() {
    isTimerRunning = true;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
        } else {
            pauseLocalTimer();
        }
    }, 1000);
}

function pauseLocalTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
}

function resetLocalTimer(seconds, mode) {
    pauseLocalTimer();
    timeRemaining = seconds;
    currentTimerMode = mode;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const secs = (timeRemaining % 60).toString().padStart(2, '0');
    timeDisplay.innerText = `${mins}:${secs}`;
    timerStateLabel.innerText = isTimerRunning ? 'In Session' : (isTimerRunning === false && timeRemaining < 25*60 ? 'Paused' : 'Ready');
    
    // Update SVG Circle
    const totalTime = currentTimerMode === 'FOCUS' ? 25 * 60 : 5 * 60;
    const progress = (totalTime - timeRemaining) / totalTime;
    const offset = circumference - (progress * circumference);
    progressCircle.style.strokeDashoffset = offset;
}

/* Tasks Logic */
function syncTasks(newTasks) {
    tasks = newTasks;
    renderTasks();
}

function addTaskLocally(task) {
    tasks.unshift(task);
    renderTasks();
    document.getElementById('task-count').innerText = tasks.filter(t => !t.completed).length;
}

function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="task-checkbox"></div>
            <div class="task-content">
                <span>${task.title}</span>
            </div>
        `;
        
        li.querySelector('.task-checkbox').addEventListener('click', () => {
            task.completed = !task.completed;
            broadcastEvent('TASK_TOGGLE', { id: task.id, completed: task.completed });
            renderTasks();
        });
        
        taskList.appendChild(li);
    });
    
    document.getElementById('task-count').innerText = tasks.filter(t => !t.completed).length;
}

window.onload = init;

/* Notes Logic */
let notes = [];
function syncNotes(newNotes) {
    notes = newNotes || [];
    renderNotes();
}

function renderNotes() {
    const journalList = document.getElementById('journal-list');
    if (!journalList) return;
    journalList.innerHTML = '';
    
    if (notes.length === 0) {
        journalList.innerHTML = '<p style="color: #666; font-style: italic;">No journal entries yet.</p>';
        return;
    }

    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'bento-box';
        div.style.background = 'rgba(255, 255, 255, 0.03)';
        div.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        
        // Truncate content to keep UI clean
        const contentPreview = note.content ? (note.content.length > 150 ? note.content.substring(0, 150) + '...' : note.content) : '';
        
        div.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff;">${note.title || 'Entry'}</h4>
            <span style="font-size: 0.8rem; color: #8899FF; display: block; margin-bottom: 1rem;">${note.date || ''}</span>
            <div style="font-size: 0.95rem; line-height: 1.5; color: #a0a0B0; white-space: pre-wrap;">${contentPreview}</div>
        `;
        journalList.appendChild(div);
    });
}
