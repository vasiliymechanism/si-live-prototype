// js/Scholarship.js - Scholarship Management Module

const Scholarship = {
    nextIndex: 1,
    generationInterval: null,
    
    // Create a new scholarship
    create(data) {
        const scholarship = {
            id: Date.now() + Math.random(),
            name: data.name,
            amount: data.amount,
            deadline: data.deadline,
            state: 'scanning',
            progress: 10,
            quizUnlock: data.quizUnlock || null,
            isFirst: data.isFirst || false,
            forcePath: data.forcePath || null,
            currentPathIndex: 0,
            assignedAction: null,
            assignedActionSubtype: null
        };
        
        // Assign random action subtype if it will need one
        if (Math.random() < 0.5) {
            const actionTypes = ['confirmEligibility', 'uploadDocument', 'updateProfile'];
            const randomType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
            scholarship.assignedAction = randomType;
            scholarship.assignedActionSubtype = State.getRandomActionSubtype(randomType);
        }
        
        return scholarship;
    },
    
    // Progress scholarship through states
    progress(scholarship) {
        // Check if all progress is paused
        if (State.appState.allProgressPaused) {
            setTimeout(() => this.progress(scholarship), 1000);
            return;
        }
        
        // Check if blocked by action required
        if (scholarship.state.includes('actionRequired')) {
            if (!this.checkActionUnblock(scholarship)) {
                // Still blocked, check again later
                setTimeout(() => this.progress(scholarship), 2000);
                return;
            }
        }
        
        // Check terminal states
        if (['notEligible', 'deadlinePassed', 'applicationSubmitted'].includes(scholarship.state)) {
            return;
        }
        
        // Special handling for readyToSubmit
        if (scholarship.state === 'readyToSubmit') {
            if (State.appState.userHasFreeTrial) {
                scholarship.state = 'applicationSubmitted';
                scholarship.progress = 100;
                // New code with smooth animations:
                if (CONFIG.features.smoothProgressUpdates) {
                    // Use smooth progress update
                    UI.updateScholarshipProgress(scholarship);
                    
                    // Check for milestone animations
                    if (CONFIG.features.milestoneEffects) {
                        const element = document.getElementById(`scholarship-${scholarship.id}`);
                        if (element) {
                            const milestones = CONFIG.animations.milestoneThresholds || [50, 90, 100];
                            
                            milestones.forEach(milestone => {
                                if (scholarship.progress >= milestone && 
                                    (scholarship.previousProgress || 0) < milestone) {
                                    element.classList.add(`milestone-${milestone}`);
                                    element.setAttribute('data-status', this.getStatusType(scholarship.state));
                                    
                                    // Remove class after animation
                                    setTimeout(() => {
                                        element.classList.remove(`milestone-${milestone}`);
                                    }, 1000);
                                }
                            });
                            
                            // Store previous progress for milestone detection
                            scholarship.previousProgress = scholarship.progress;
                        }
                    }
                } else {
                    // Fall back to recreating element
                    UI.updateScholarshipDisplay(scholarship);
                }
                Metrics.update();
            }
            return;
        }
        
        // Determine next state
        let nextState = null;
        
        if (scholarship.forcePath && scholarship.currentPathIndex < scholarship.forcePath.length) {
            // Follow forced path
            nextState = scholarship.forcePath[scholarship.currentPathIndex];
            scholarship.currentPathIndex++;
        } else if (scholarship.forcePath && scholarship.currentPathIndex >= scholarship.forcePath.length) {
            // Forced path is complete, clear it and use normal progression
            scholarship.forcePath = null;
            const progressionOptions = CONFIG.stateProgression[scholarship.state];
        } else {
            // Random progression based on probabilities
            const progressionOptions = CONFIG.stateProgression[scholarship.state];
            if (!progressionOptions) return;
            
            const random = Math.random();
            let cumulativeProbability = 0;
            
            for (const option of progressionOptions) {
                cumulativeProbability += option.probability;
                if (random <= cumulativeProbability) {
                    nextState = option.next;
                    break;
                }
            }
        }
        
        if (nextState) {
            // Update state
            scholarship.state = nextState;
            
            // Update progress bar
            const progressMap = {
                'checkingDeadline': 20,
                'checkingEligibility': 30,
                'matchFound': 50,
                'gettingRequirements': 60,
                'preparingMaterials': 70,
                'writingEssay': 80,
                'finalizingApplication': 90,
                'readyToSubmit': 95,
                'applicationSubmitted': 100
            };
            
            const cleanState = nextState.replace('actionRequired:', '');
            scholarship.progress = progressMap[cleanState] || scholarship.progress + 10;
            
            // Update display
            // New code with smooth animations:
            if (CONFIG.features.smoothProgressUpdates) {
                // Use smooth progress update
                UI.updateScholarshipProgress(scholarship);
                
                // Check for milestone animations
                if (CONFIG.features.milestoneEffects) {
                    const element = document.getElementById(`scholarship-${scholarship.id}`);
                    if (element) {
                        const milestones = CONFIG.animations.milestoneThresholds || [50, 90, 100];
                        
                        milestones.forEach(milestone => {
                            if (scholarship.progress >= milestone && 
                                (scholarship.previousProgress || 0) < milestone) {
                                element.classList.add(`milestone-${milestone}`);
                                element.setAttribute('data-status', this.getStatusType(scholarship.state));
                                
                                // Remove class after animation
                                setTimeout(() => {
                                    element.classList.remove(`milestone-${milestone}`);
                                }, 1000);
                            }
                        });
                        
                        // Store previous progress for milestone detection
                        scholarship.previousProgress = scholarship.progress;
                    }
                }
            } else {
                // Fall back to recreating element
                UI.updateScholarshipDisplay(scholarship);
            }
            
            // Update metrics and add time saved
            this.updateMetricsForState(scholarship, cleanState);
            
            // Handle action required states
            if (nextState.includes('actionRequired')) {
                this.handleActionRequired(scholarship, nextState);
            }
            
            // Schedule next progression
            const timingConfig = CONFIG.timings.stateTransitions[cleanState] || 
                                { min: 2000, max: 5000 };
            const delay = Math.random() * (timingConfig.max - timingConfig.min) + timingConfig.min;
            
            setTimeout(() => this.progress(scholarship), delay);
        }
    },
    
    // Check if action unblocks scholarship
    checkActionUnblock(scholarship) {
        const actionType = scholarship.state.replace('actionRequired:', '');
        
        // Track 1: Check if quiz has provided the answer
        if (actionType === 'confirmEligibility') {
            // Check if quiz answered the general unlock
            if (scholarship.quizUnlock && State.hasQuizUnlock(scholarship.quizUnlock)) {
                scholarship.state = 'matchFound';
                scholarship.progress = 50;
                return true;
            }
            
            // Check if specific subtype was completed (via quiz or individual action)
            if (scholarship.assignedActionSubtype && 
                State.isActionCompleted('confirmEligibility', scholarship.assignedActionSubtype)) {
                scholarship.state = 'matchFound';
                scholarship.progress = 50;
                return true;
            }
        }
        
        // Track 2: Check individual action completion
        if (scholarship.assignedActionSubtype) {
            if (State.isActionCompleted(actionType, scholarship.assignedActionSubtype)) {
                const nextStateMap = {
                    'confirmEligibility': 'matchFound',
                    'uploadDocument': 'writingEssay',
                    'updateProfile': 'readyToSubmit'
                };
                scholarship.state = nextStateMap[actionType] || 'matchFound';
                return true;
            }
        }
        
        // Track 3: Check general quiz completion for profile updates
        if (actionType === 'updateProfile' && Object.keys(State.appState.quizAnswers).length > 5) {
            scholarship.state = 'readyToSubmit';
            scholarship.progress = 95;
            return true;
        }
        
        return false;
    },
    
    // Handle action required state
    handleActionRequired(scholarship, actionType) {
        const cleanType = actionType.replace('actionRequired:', '');
    
        // Ensure assignedActionSubtype is a string, not an object
        if (!scholarship.assignedActionSubtype || typeof scholarship.assignedActionSubtype !== 'string') {
            scholarship.assignedActionSubtype = State.getRandomActionSubtype(cleanType);
        }
        
        // Special case for first scholarship
        if (scholarship.isFirst && cleanType === 'confirmEligibility') {
            Event.addAction({
                type: 'startQuiz',
                title: 'Update profile to confirm matches', // Ensure this is a string
                scholarshipId: scholarship.id,
                priority: true,
                sticky: true,
                onclick: () => Quiz.open()
            });
            return;
        }

        // Inside Scholarship.handleActionRequired
        if (scholarship.isFirst && cleanType === 'confirmEligibility') {
            // Check if quiz is complete and relevant answer exists
            if (State.appState.quizAnswers['gpa']) {
                // Progress to next state
                scholarship.state = 'matchFound';
                this.updateMetricsForState(scholarship, 'matchFound');
                State.updateScholarship(scholarship.id, { state: 'matchFound' });
            }
        }
        
        const actionConfig = {
            'confirmEligibility': {
                title: scholarship.assignedActionSubtype, // This must be a string
                modalType: 'input',
                onclick: () => Event.openConfirmModal('confirmEligibility', scholarship)
            },
            'uploadDocument': {
                title: scholarship.assignedActionSubtype,
                modalType: 'upload',
                onclick: () => Event.openUploadModal(scholarship)
            },
            'updateProfile': {
                title: scholarship.assignedActionSubtype,
                modalType: 'input',
                onclick: () => Event.openProfileUpdateModal('updateProfile', scholarship)
            }
        };
        
        const config = actionConfig[cleanType];
        if (config) {
            Event.addAction({
                type: cleanType,
                subtype: scholarship.assignedActionSubtype,
                title: config.title,
                scholarshipId: scholarship.id,
                deadline: scholarship.deadline,
                onclick: config.onclick,
                modalType: config.modalType
            });
        }
    },
    
    // Update metrics for state change
    updateMetricsForState(scholarship, state) {
        // Add time saved
        const timingConfig = CONFIG.timings.stateTransitions[state];
        if (timingConfig && timingConfig.timeSaved) {
            const timeSaved = Math.floor(
                Math.random() * (timingConfig.timeSaved.max - timingConfig.timeSaved.min) + 
                timingConfig.timeSaved.min
            );
            State.addTimeSaved(timeSaved);
        }
        
        // Update other metrics
        Metrics.update();
    },
    
    // Start generating scholarships
    startGeneration() {
        console.log('Starting scholarship generation');

        const generate = () => {
            // Remove the isPaused check - use specific flags instead
            if (State.appState.newScholarshipsPaused || !State.appState.isRunning) {
                // Retry later if paused
                setTimeout(generate, 2000);
                return;
            }

            // Check if generation is paused
            if (State.appState.newScholarshipsPaused || !State.appState.isRunning) {
                return;
            }
            
            // Check if we have more scholarships to generate
            if (this.nextIndex >= State.scholarshipData.length) {
                return;
            }
            
            // Create new scholarship
            const data = State.scholarshipData[this.nextIndex];
            const scholarship = this.create(data);
            State.addScholarship(scholarship);
            
            // Add to UI
            UI.addScholarshipToFeed(scholarship);
            
            // Start progressing
            setTimeout(() => this.progress(scholarship), 2000);
            
            this.nextIndex++;
            
            // Schedule next generation
            const interval = CONFIG.timings.newScholarshipInterval;
            const delay = Math.random() * (interval.max - interval.min) + interval.min;
            setTimeout(generate, delay);
        };
        
        // Start generation loop
        generate();
    },

    // Add this helper function to Scholarship module:
    getStatusType(state) {
        if (state === 'readyToSubmit') return 'ready';
        if (state.includes('actionRequired')) return 'action-required';
        if (['notEligible', 'deadlinePassed'].includes(state)) return 'failed';
        if (state === 'applicationSubmitted') return 'completed';
        return 'processing';
    },

    getNextStateForAction(actionType) {
        const nextStateMap = {
            'confirmEligibility': 'matchFound',
            'uploadDocument': 'writingEssay',
            'updateProfile': 'readyToSubmit'
        };
        return nextStateMap[actionType] || 'matchFound';
    }
};