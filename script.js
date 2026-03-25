document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('taskInput');
    const taskDate = document.getElementById('taskDate');
    const taskHour = document.getElementById('taskHour');
    const taskMinute = document.getElementById('taskMinute');
    const taskSecond = document.getElementById('taskSecond');
    const taskAmPm = document.getElementById('taskAmPm');
    const taskSound = document.getElementById('taskSound');
    const previewSoundBtn = document.getElementById('previewSoundBtn');
    
    const addBtn = document.getElementById('addBtn');
    const taskList = document.getElementById('taskList');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    // Alarm Popup Elements
    const alarmSound = document.getElementById('alarmSound');
    const alarmModal = document.getElementById('alarmModal');
    const alarmTaskText = document.getElementById('alarmTaskText');
    const stopAlarmBtn = document.getElementById('stopAlarmBtn');

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';
    let currentAlarmTaskId = null;

    let userInteracted = false;
    document.body.addEventListener('click', () => {
        userInteracted = true;
    }, { once: true });

    let playingFallbackWords = null;
    
    // Play with fallback
    function attemptPlay(textForFallback = "Wake up! Alarm!") {
        alarmSound.play().catch(e => {
            console.warn('Audio playback prevented -> Switching to Voice Fallback', e);
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(textForFallback);
                utterance.rate = 0.9;
                utterance.pitch = 1.2;
                window.speechSynthesis.speak(utterance);
                playingFallbackWords = utterance;
            }
        });
    }

    function stopAllAudioAndVoice() {
        alarmSound.pause();
        alarmSound.currentTime = 0;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    // Sound Preview Logic
    let previewTimeout;
    let isPreviewing = false;

    function stopPreview() {
        stopAllAudioAndVoice();
        previewSoundBtn.innerHTML = '<i class="fas fa-play"></i>';
        clearTimeout(previewTimeout);
        isPreviewing = false;
    }

    function playSpecificSound(btnIcon = '<i class="fas fa-stop"></i>') {
        userInteracted = true;
        stopAllAudioAndVoice();
        
        alarmSound.src = taskSound.value; 
        
        let playPromise = alarmSound.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                previewSoundBtn.innerHTML = btnIcon;
                isPreviewing = true;
                
                clearTimeout(previewTimeout);
                // Allow sound to play for 3 seconds before stopping to sample
                previewTimeout = setTimeout(() => {
                    stopPreview();
                }, 3000);
            }).catch(e => {
                console.warn('Preview blocked:', e);
                attemptPlay("Previewing Sound Selection.");
            });
        }
    }

    function togglePreview() {
        if (isPreviewing) {
            stopPreview();
        } else {
            playSpecificSound('<i class="fas fa-stop"></i>');
        }
    }

    previewSoundBtn.addEventListener('click', togglePreview);

    // Auto-play preview when a user changes the sound in the dropdown
    taskSound.addEventListener('change', () => {
        // Automatically play the sound when they select it
        playSpecificSound('<i class="fas fa-music"></i>');
    });

    // Set today's date as default
    function setDefaultDate() {
        const today = new Date();
        const y = today.getFullYear();
        const m = (today.getMonth() + 1).toString().padStart(2, '0');
        const d = today.getDate().toString().padStart(2, '0');
        taskDate.value = `${y}-${m}-${d}`;
    }

    // Populate time dropdowns
    function populateDropdowns() {
        setDefaultDate();

        taskHour.innerHTML = '<option value="">Hr</option>';
        for (let i = 1; i <= 12; i++) {
            const val = i.toString().padStart(2, '0');
            taskHour.innerHTML += `<option value="${val}">${val}</option>`;
        }

        taskMinute.innerHTML = '<option value="">Min</option>';
        for (let i = 0; i <= 59; i++) {
            const val = i.toString().padStart(2, '0');
            taskMinute.innerHTML += `<option value="${val}">${val}</option>`;
        }

        taskSecond.innerHTML = '<option value="">Sec</option>';
        for (let i = 0; i <= 59; i++) {
            const val = i.toString().padStart(2, '0');
            taskSecond.innerHTML += `<option value="${val}">${val}</option>`;
        }
    }
    populateDropdowns();

    function renderTasks() {
        taskList.innerHTML = '';
        
        const filteredTasks = tasks.filter(task => {
            if (currentFilter === 'pending') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true;
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state">No tasks to show. You're all caught up! ✨</div>`;
            return;
        }

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;

            let timeHtml = '';
            let soundIndicatorHtml = '';
            if (task.timeObj) {
                const displayTime = `${task.timeObj.date} at ${task.timeObj.h}:${task.timeObj.m}:${task.timeObj.s} ${task.timeObj.ampm}`;
                timeHtml = `<span class="task-time" style="font-size: 0.85rem; color: #888; display: block; margin-top: 4px;"><i class="far fa-clock"></i> ${displayTime}</span>`;
                soundIndicatorHtml = `<span style="font-size: 0.75rem; color: #cbd5e1; margin-left: 5px;" title="Alarm Set"><i class="fas fa-music"></i></span>`;
            }

            li.innerHTML = `
                <div class="task-checkbox" role="checkbox" aria-checked="${task.completed}"></div>
                <div class="task-content" style="flex: 1;">
                    <span class="task-text">${escapeHtml(task.text)} ${soundIndicatorHtml}</span>
                    ${timeHtml}
                </div>
                <button class="delete-btn" aria-label="Delete task">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            li.querySelector('.task-checkbox').addEventListener('click', () => {
                task.completed = !task.completed;
                saveAndRender();
            });
            li.querySelector('.task-content').addEventListener('click', () => {
                task.completed = !task.completed;
                saveAndRender();
            });

            li.querySelector('.delete-btn').addEventListener('click', (e) => {
                li.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    tasks = tasks.filter(t => t.id !== task.id);
                    saveAndRender();
                }, 300);
            });

            taskList.appendChild(li);
        });
    }

    function addTask() {
        const text = taskInput.value.trim();
        const dt = taskDate.value; 
        const h = taskHour.value;
        const m = taskMinute.value;
        const s = taskSecond.value;
        const ampm = taskAmPm.value;
        const sfx = taskSound.value;

        const timeObj = (dt && h && m && s) ? { date: dt, h, m, s, ampm, soundUrl: sfx } : null;

        if (text) {
            tasks.unshift({
                id: Date.now().toString(),
                text: text,
                timeObj: timeObj,
                completed: false,
                alarmPlayed: false
            });
            taskInput.value = '';
            taskHour.value = '';
            taskMinute.value = '';
            taskSecond.value = '';
            taskInput.focus();
            saveAndRender();
        }
    }

    function saveAndRender() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }

    function checkAlarms() {
        const now = new Date();
        
        const currentY = now.getFullYear();
        const currentMoth = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentD = now.getDate().toString().padStart(2, '0');
        const currentDateStr = `${currentY}-${currentMoth}-${currentD}`; 

        let currentH = now.getHours();
        const currentAmPm = currentH >= 12 ? 'PM' : 'AM';
        currentH = currentH % 12;
        currentH = currentH ? currentH : 12; 
        const currentHourStr = currentH.toString().padStart(2, '0');
        
        const currentM = now.getMinutes().toString().padStart(2, '0');
        const currentS = now.getSeconds().toString().padStart(2, '0');

        let changed = false;

        tasks.forEach(task => {
            if (task.timeObj && !task.completed && !task.alarmPlayed) {
                const matchesDate = task.timeObj.date === currentDateStr;
                const matchesHour = task.timeObj.h === currentHourStr;
                const matchesMinute = task.timeObj.m === currentM;
                const matchesSecond = task.timeObj.s === currentS;
                const matchesAmPm = task.timeObj.ampm === currentAmPm;

                if (matchesDate && matchesHour && matchesMinute && matchesSecond && matchesAmPm) {
                    
                    currentAlarmTaskId = task.id; 
                    alarmTaskText.textContent = task.text;
                    
                    alarmSound.src = task.timeObj.soundUrl || taskSound.options[0].value;
                    
                    alarmModal.classList.remove('hidden');

                    if (userInteracted) {
                        attemptPlay(`It is time for your task! ${task.text}`);
                    }

                    task.alarmPlayed = true; 
                    changed = true;
                }
            }
        });

        if (changed) {
            saveAndRender();
        }
    }

    stopAlarmBtn.addEventListener('click', () => {
        stopAllAudioAndVoice();
        alarmModal.classList.add('hidden');

        if (currentAlarmTaskId) {
            const taskObj = tasks.find(t => t.id === currentAlarmTaskId);
            if (taskObj && !taskObj.completed) {
                taskObj.completed = true;
                saveAndRender(); 
            }
            currentAlarmTaskId = null;
        }
    });

    setInterval(checkAlarms, 1000);

    addBtn.addEventListener('click', addTask);
    
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    renderTasks();
});
