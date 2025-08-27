// js/Event.js - Event Management Module

const Event = {
    // Add action to the queue
    addAction(action) {
        if (State.addAction(action)) {
            UI.renderActions();
        }
    },
    
    // Skip an action (click Later)
    skipAction(actionId) {
        // For now, just remove it from display but may come back later
        const action = State.appState.actions.find(a => a.id === actionId);
        if (action && action.type !== 'sendApplications') {
            // Temporarily remove from queue
            State.removeAction(actionId);
            UI.renderActions();
            
            // Re-add after delay
            setTimeout(() => {
                State.addAction(action);
                UI.renderActions();
            }, 30000); // Re-appears after 30 seconds
        }
    },
    
    // Open input modal for various action types
    openInputModal(actionType, scholarship) {
        const modal = document.getElementById('inputModal');
        const modalTitle = document.getElementById('inputModalTitle');
        const modalDescription = document.getElementById('inputModalDescription');
        const modalBody = document.getElementById('inputModalBody');
        
        // Configure modal based on action type
        const configs = {
            uploadDocument: {
                title: scholarship.assignedActionSubtype || 'Upload Document',
                description: 'Please upload the required document',
                content: `
                    <div class="quiz-file-upload" id="fileUploadArea">
                        <p>Click to upload file or drag and drop</p>
                        <input type="file" id="fileInput" style="display: none;">
                    </div>
                    <div class="quiz-actions">
                        <button class="quiz-btn primary" onclick="Event.completeUpload('${scholarship.id}')">Upload</button>
                        <button class="quiz-btn secondary" onclick="UI.closeModal('inputModal')">Cancel</button>
                    </div>
                `
            },
            textInput: {
                title: 'Additional Information',
                description: 'Please provide the requested information',
                content: `
                    <input type="text" class="quiz-input" id="textInput" placeholder="Enter your response">
                    <div class="quiz-actions">
                        <button class="quiz-btn primary" onclick="Event.completeTextInput('${scholarship.id}')">Submit</button>
                        <button class="quiz-btn secondary" onclick="UI.closeModal('inputModal')">Cancel</button>
                    </div>
                `
            }
        };
        
        const config = configs[actionType] || configs.textInput;
        
        modalTitle.textContent = config.title;
        modalDescription.textContent = config.description;
        modalBody.innerHTML = config.content;
        
        // Set up file upload if needed
        if (actionType === 'uploadDocument') {
            const fileUploadArea = document.getElementById('fileUploadArea');
            const fileInput = document.getElementById('fileInput');
            
            fileUploadArea.onclick = () => fileInput.click();
            
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    fileUploadArea.innerHTML = `<p>Selected: ${e.target.files[0].name}</p>`;
                }
            };
            
            // Drag and drop
            fileUploadArea.ondragover = (e) => {
                e.preventDefault();
                fileUploadArea.style.borderColor = '#555';
            };
            
            fileUploadArea.ondragleave = () => {
                fileUploadArea.style.borderColor = '#333';
            };
            
            fileUploadArea.ondrop = (e) => {
                e.preventDefault();
                fileUploadArea.style.borderColor = '#333';
                if (e.dataTransfer.files.length > 0) {
                    fileUploadArea.innerHTML = `<p>Selected: ${e.dataTransfer.files[0].name}</p>`;
                }
            };
        }
        
        UI.openModal('inputModal');
    },
    
    // Complete upload action
    completeUpload(scholarshipId) {
        const scholarship = State.getScholarship(scholarshipId);
        if (scholarship) {
            // Mark action as completed
            if (scholarship.assignedActionSubtype) {
                State.completeAction('uploadDocument', scholarship.assignedActionSubtype);
            }
            
            // Progress scholarship
            scholarship.state = 'writingEssay';
            scholarship.progress = 80;
            UI.updateScholarshipDisplay(scholarship);
            
            // Remove action from queue
            State.appState.actions = State.appState.actions.filter(a => 
                !(a.type === 'uploadDocument' && a.scholarshipId === scholarshipId)
            );
            UI.renderActions();
            
            // Continue progression
            setTimeout(() => Scholarship.progress(scholarship), 3000);
        }
        
        UI.closeModal('inputModal');
    },
    
    // Complete text input action
    completeTextInput(scholarshipId) {
        const scholarship = State.getScholarship(scholarshipId);
        if (scholarship) {
            // Progress scholarship based on current state
            if (scholarship.state.includes('updateProfile')) {
                scholarship.state = 'readyToSubmit';
                scholarship.progress = 95;
            }
            
            UI.updateScholarshipDisplay(scholarship);
            setTimeout(() => Scholarship.progress(scholarship), 2000);
        }
        
        UI.closeModal('inputModal');
    },
    
    // Open paywall modal
    openPaywall() {
        const modal = document.getElementById('paywallModal');
        const description = document.getElementById('paywallDescription');
        
        // Update description with actual numbers
        const readyCount = State.appState.metrics.readyToApply;
        description.textContent = `Start your 3-day free trial to submit ${readyCount} applications`;
        
        UI.openModal('paywallModal');
    },

    openConfirmModal(actionType, scholarship) {
        const modal = document.getElementById('inputModal');
        const modalTitle = document.getElementById('inputModalTitle');
        const modalDescription = document.getElementById('inputModalDescription');
        const modalBody = document.getElementById('inputModalBody');
        
        const subtype = scholarship.assignedActionSubtype || State.getRandomActionSubtype(actionType);
        
        // Check if this was already answered in quiz
        if (this.isAnsweredInQuiz(actionType, subtype)) {
            // Auto-complete this action
            this.autoCompleteAction(scholarship, actionType);
            return;
        }
        
        modalTitle.textContent = subtype;
        modalDescription.textContent = 'Please confirm the following requirement';
        
        modalBody.innerHTML = `
            <div class="confirmation-box">
                <p>${this.getConfirmationText(actionType, subtype)}</p>
                <div class="quiz-actions">
                    <button class="quiz-btn primary" onclick="Event.confirmAndProgress('${scholarship.id}', '${actionType}', '${subtype}')">
                        Confirm
                    </button>
                    <button class="quiz-btn secondary" onclick="UI.closeModal('inputModal')">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        UI.openModal('inputModal');
    },

    openUploadModal(scholarship) {
        const modal = document.getElementById('inputModal');
        const modalTitle = document.getElementById('inputModalTitle');
        const modalDescription = document.getElementById('inputModalDescription');
        const modalBody = document.getElementById('inputModalBody');
        
        const subtype = scholarship.assignedActionSubtype || State.getRandomActionSubtype('uploadDocument');
        
        modalTitle.textContent = subtype;
        modalDescription.textContent = 'Please upload the required document';
        
        modalBody.innerHTML = `
            <div class="quiz-file-upload" id="fileUploadArea">
                <p>Click to upload file or drag and drop</p>
                <p class="file-type-hint">${this.getFileTypeHint(subtype)}</p>
                <input type="file" id="fileInput" style="display: none;">
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Event.completeUpload('${scholarship.id}', '${subtype}')">
                    Upload
                </button>
                <button class="quiz-btn secondary" onclick="UI.closeModal('inputModal')">
                    Cancel
                </button>
            </div>
        `;
        
        this.setupFileUploadHandlers();
        UI.openModal('inputModal');
    },

    openProfileUpdateModal(actionType, scholarship) {
        const modal = document.getElementById('inputModal');
        const subtype = scholarship.assignedActionSubtype || State.getRandomActionSubtype(actionType);
        
        // Check if this specific info was provided in quiz
        if (this.isAnsweredInQuiz('updateProfile', subtype)) {
            this.autoCompleteAction(scholarship, actionType);
            return;
        }
        
        // Build appropriate input form based on subtype
        const inputType = this.getInputTypeForProfile(subtype);
        
        modalTitle.textContent = subtype;
        modalDescription.textContent = 'Please provide the following information';
        
        if (inputType === 'text') {
            modalBody.innerHTML = `
                <input type="text" class="quiz-input" id="profileInput" 
                    placeholder="${this.getPlaceholderForProfile(subtype)}">
                <div class="quiz-actions">
                    <button class="quiz-btn primary" 
                            onclick="Event.completeProfileUpdate('${scholarship.id}', '${subtype}')">
                        Save
                    </button>
                    <button class="quiz-btn secondary" onclick="UI.closeModal('inputModal')">
                        Cancel
                    </button>
                </div>
            `;
        } else if (inputType === 'select') {
            // Build select options based on subtype
            modalBody.innerHTML = this.buildSelectForProfile(subtype, scholarship.id);
        }
        
        UI.openModal('inputModal');
    },

    // Helper to check if quiz already answered this
    isAnsweredInQuiz(actionType, subtype) {
        // Map subtypes to quiz question IDs
        const quizMapping = {
            'confirmEligibility': {
                'Confirm GPA requirement': 'gpa',
                'Verify enrollment status': 'year',
                'Confirm major/field of study': 'major'
            },
            'updateProfile': {
                'Update financial information': 'financialNeed',
                'Add extracurricular activities': 'extracurriculars'
            }
        };
        
        const questionId = quizMapping[actionType]?.[subtype];
        return questionId && State.appState.quizAnswers.hasOwnProperty(questionId);
    },

    // Auto-complete action if already answered in quiz
    autoCompleteAction(scholarship, actionType) {
        // Mark as completed
        State.completeAction(actionType, scholarship.assignedActionSubtype);
        
        // Progress scholarship
        const nextStateMap = {
            'confirmEligibility': 'matchFound',
            'uploadDocument': 'writingEssay',
            'updateProfile': 'readyToSubmit'
        };
        
        scholarship.state = nextStateMap[actionType];
        scholarship.progress += 20;
        UI.updateScholarshipDisplay(scholarship);
        
        // Remove from action queue
        State.appState.actions = State.appState.actions.filter(a => 
            !(a.scholarshipId === scholarship.id && a.type === actionType)
        );
        UI.renderActions();
        
        // Show brief notification
        this.showNotification(`Already completed via quiz - skipping ${scholarship.assignedActionSubtype}`);
        
        setTimeout(() => Scholarship.progress(scholarship), 1000);
    }, 

    confirmAndProgress(scholarshipId, actionType, subtype) {
        const scholarship = State.getScholarship(scholarshipId);
        if (!scholarship) return;
        
        // Mark this specific action as completed
        State.completeAction(actionType, subtype);
        
        // Progress this scholarship
        const nextStateMap = {
            'confirmEligibility': 'matchFound',
            'uploadDocument': 'writingEssay',  
            'updateProfile': 'readyToSubmit'
        };
        
        scholarship.state = nextStateMap[actionType];
        scholarship.progress += 20;
        UI.updateScholarshipDisplay(scholarship);
        
        // Remove this action from queue
        State.appState.actions = State.appState.actions.filter(a => 
            !(a.scholarshipId === scholarshipId && a.type === actionType)
        );
        
        // Check if other scholarships have the same requirement
        State.appState.scholarships.forEach(s => {
            if (s.id !== scholarshipId && 
                s.state === `actionRequired:${actionType}` &&
                s.assignedActionSubtype === subtype) {
                // Unblock them too
                s.state = nextStateMap[actionType];
                s.progress += 20;
                UI.updateScholarshipDisplay(s);
                setTimeout(() => Scholarship.progress(s), 100);
            }
        });
        
        UI.renderActions();
        UI.closeModal('inputModal');
        
        // Continue progression
        setTimeout(() => Scholarship.progress(scholarship), 1000);
    }
};