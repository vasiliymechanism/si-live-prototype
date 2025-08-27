// js/Quiz.js - Quiz Management Module

const Quiz = {
    // Quiz configuration - would be loaded from data/quiz.json
    config: {
        questions: [
            {
                id: 'welcome',
                type: 'interstitial',
                title: 'Let\'s Match You With Scholarships',
                description: 'This quick profile will help us find the best opportunities for you.',
                next: 'gpa'
            },
            {
                id: 'gpa',
                type: 'single-select',
                title: 'What is your current GPA?',
                description: 'Select the range that best matches your cumulative GPA',
                options: [
                    { value: '4.0+', label: '4.0 or above' },
                    { value: '3.5-3.9', label: '3.5 - 3.9' },
                    { value: '3.0-3.4', label: '3.0 - 3.4' },
                    { value: '2.5-2.9', label: '2.5 - 2.9' },
                    { value: '<2.5', label: 'Below 2.5' }
                ],
                next: (answers) => {
                    if (answers.gpa === '4.0+' || answers.gpa === '3.5-3.9') {
                        return 'honors';
                    }
                    return 'major';
                }
            },
            {
                id: 'honors',
                type: 'multi-select',
                title: 'Academic Honors & Awards',
                description: 'Select all that apply to you',
                options: [
                    { value: 'deans', label: 'Dean\'s List' },
                    { value: 'honor-society', label: 'Honor Society Member' },
                    { value: 'valedictorian', label: 'Valedictorian/Salutatorian' },
                    { value: 'ap-scholar', label: 'AP Scholar' },
                    { value: 'none', label: 'None of the above' }
                ],
                next: 'major'
            },
            {
                id: 'major',
                type: 'single-select',
                title: 'What is your intended major?',
                description: 'Choose the field you plan to study',
                options: [
                    { value: 'stem', label: 'STEM (Science, Technology, Engineering, Math)' },
                    { value: 'business', label: 'Business & Economics' },
                    { value: 'humanities', label: 'Humanities & Liberal Arts' },
                    { value: 'health', label: 'Health & Medicine' },
                    { value: 'arts', label: 'Arts & Design' },
                    { value: 'undecided', label: 'Undecided' }
                ],
                next: 'year'
            },
            {
                id: 'year',
                type: 'single-select',
                title: 'Current Education Level',
                description: 'What year are you in?',
                options: [
                    { value: 'hs-senior', label: 'High School Senior' },
                    { value: 'hs-junior', label: 'High School Junior' },
                    { value: 'college-freshman', label: 'College Freshman' },
                    { value: 'college-sophomore', label: 'College Sophomore' },
                    { value: 'college-junior', label: 'College Junior' },
                    { value: 'graduate', label: 'Graduate Student' }
                ],
                next: 'financialNeed'
            },
            {
                id: 'financialNeed',
                type: 'single-select',
                title: 'Financial Need Assessment',
                description: 'What is your family\'s annual household income?',
                options: [
                    { value: 'high', label: 'Under $30,000' },
                    { value: 'medium-high', label: '$30,000 - $60,000' },
                    { value: 'medium', label: '$60,000 - $100,000' },
                    { value: 'low', label: 'Over $100,000' }
                ],
                next: 'extracurriculars'
            },
            {
                id: 'extracurriculars',
                type: 'multi-select',
                title: 'Extracurricular Activities',
                description: 'Select all areas where you\'re actively involved',
                options: [
                    { value: 'sports', label: 'Varsity/Club Sports' },
                    { value: 'leadership', label: 'Student Government/Leadership' },
                    { value: 'volunteer', label: 'Community Service/Volunteering' },
                    { value: 'work', label: 'Part-time Job/Internship' },
                    { value: 'clubs', label: 'Academic Clubs/Competitions' },
                    { value: 'arts', label: 'Music/Theater/Arts' }
                ],
                next: 'personalInfo'
            },
            {
                id: 'personalInfo',
                type: 'text-input',
                title: 'Personal Statement',
                description: 'Tell us briefly about your goals (optional)',
                placeholder: 'Your educational and career goals...',
                skippable: true,
                skipText: 'Skip for now',
                next: 'birthdate'
            },
            {
                id: 'birthdate',
                type: 'date-selector',
                title: 'Date of Birth',
                description: 'This helps us match age-specific scholarships',
                next: 'documents'
            },
            {
                id: 'documents',
                type: 'file-upload',
                title: 'Upload Transcript (Optional)',
                description: 'You can upload your transcript now or later',
                skippable: true,
                skipText: 'I\'ll upload later',
                multiple: false,
                next: 'terms'
            },
            {
                id: 'terms',
                type: 'checkbox',
                title: 'Terms and Conditions',
                description: 'Please review and accept our terms',
                checkboxText: 'I agree to the Terms of Service and Privacy Policy',
                next: 'essays'
            },
            {
                id: 'essays',
                type: 'single-select',
                title: 'Essay Writing Preference',
                description: 'How would you like us to handle essays?',
                options: [
                    { value: 'full-ai', label: 'Write them completely for me' },
                    { value: 'ai-draft', label: 'Create drafts I can edit' },
                    { value: 'outline', label: 'Provide outlines only' },
                    { value: 'self', label: 'I\'ll write them myself' }
                ],
                next: 'complete'
            },
            {
                id: 'complete',
                type: 'interstitial',
                title: 'Profile Complete!',
                description: 'We\'re now matching you with scholarships and preparing your applications.',
                next: null
            }
        ]
    },
    
    currentQuestionIndex: 0,
    
    // Open quiz modal
    open() {
        UI.openModal('quizModal');
        State.appState.isPaused = true;
        this.loadQuestion(0);
    },
    
    // Load a specific question
    loadQuestion(index) {
        const question = this.config.questions[index];
        if (!question) return;
        
        this.currentQuestionIndex = index;
        State.appState.currentQuizQuestion = index;
        
        const quizBody = document.getElementById('quizBody');
        
        // Build progress indicator
        const progress = `
            <div class="quiz-progress">
                ${this.config.questions.map((q, i) => 
                    `<div class="progress-dot ${i <= index ? 'active' : ''}"></div>`
                ).join('')}
            </div>
        `;
        
        let content = progress;
        
        // Build question content based on type
        switch (question.type) {
            case 'interstitial':
                content += this.buildInterstitial(question);
                break;
            case 'single-select':
                content += this.buildSingleSelect(question);
                break;
            case 'multi-select':
                content += this.buildMultiSelect(question);
                break;
            case 'text-input':
                content += this.buildTextInput(question);
                break;
            case 'date-selector':
                content += this.buildDateSelector(question);
                break;
            case 'file-upload':
                content += this.buildFileUpload(question);
                break;
            case 'checkbox':
                content += this.buildCheckbox(question);
                break;
        }
        
        quizBody.innerHTML = content;
        
        // Set up any necessary event handlers
        this.setupQuestionHandlers(question);
    },
    
    // Build interstitial question
    buildInterstitial(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()">
                    ${question.next === null ? 'Complete' : 'Continue'}
                </button>
            </div>
        `;
    },
    
    // Build single select question
    buildSingleSelect(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <div class="quiz-options">
                    ${question.options.map(opt => `
                        <div class="quiz-option" data-value="${opt.value}">
                            ${opt.label}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()" disabled>Continue</button>
                ${question.skippable ? `<button class="quiz-btn secondary" onclick="Quiz.skipQuestion()">${question.skipText || 'Skip'}</button>` : ''}
            </div>
        `;
    },
    
    // Build multi select question
    buildMultiSelect(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <div class="quiz-options">
                    ${question.options.map(opt => `
                        <div class="quiz-option" data-value="${opt.value}">
                            ${opt.label}
                        </div>
                    `).join('')}
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 12px;">Select all that apply</p>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()">Continue</button>
            </div>
        `;
    },
    
    // Build text input question
    buildTextInput(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <textarea class="quiz-input" id="textInput" placeholder="${question.placeholder || 'Enter your response'}" rows="4"></textarea>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()">Continue</button>
                ${question.skippable ? `<button class="quiz-btn secondary" onclick="Quiz.skipQuestion()">${question.skipText || 'Skip'}</button>` : ''}
            </div>
        `;
    },
    
    // Build date selector question
    buildDateSelector(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <div class="quiz-date-inputs">
                    <input type="number" id="monthInput" placeholder="MM" min="1" max="12" maxlength="2">
                    <input type="number" id="dayInput" placeholder="DD" min="1" max="31" maxlength="2">
                    <input type="number" id="yearInput" placeholder="YYYY" min="1900" max="2010" maxlength="4">
                </div>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()">Continue</button>
            </div>
        `;
    },
    
    // Build file upload question
    buildFileUpload(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <div class="quiz-file-upload" id="fileUploadArea">
                    <p>Click to upload or drag and drop</p>
                    <input type="file" id="fileInput" style="display: none;" ${question.multiple ? 'multiple' : ''}>
                </div>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()">Upload</button>
                ${question.skippable ? `<button class="quiz-btn secondary" onclick="Quiz.skipQuestion()">${question.skipText || 'Skip'}</button>` : ''}
            </div>
        `;
    },
    
    // Build checkbox question
    buildCheckbox(question) {
        return `
            <div class="quiz-question">
                <h3>${question.title}</h3>
                <p>${question.description}</p>
                <div class="quiz-checkbox">
                    <input type="checkbox" id="termsCheckbox">
                    <label for="termsCheckbox">${question.checkboxText}</label>
                </div>
            </div>
            <div class="quiz-actions">
                <button class="quiz-btn primary" onclick="Quiz.handleAnswer()" disabled>Continue</button>
            </div>
        `;
    },
    
    // Setup event handlers for current question
    setupQuestionHandlers(question) {
        if (question.type === 'single-select') {
            document.querySelectorAll('.quiz-option').forEach(option => {
                option.addEventListener('click', () => this.selectSingleOption(option));
            });
        } else if (question.type === 'multi-select') {
            document.querySelectorAll('.quiz-option').forEach(option => {
                option.addEventListener('click', () => this.selectMultiOption(option));
            });
        } else if (question.type === 'checkbox') {
            const checkbox = document.getElementById('termsCheckbox');
            checkbox.addEventListener('change', () => {
                document.querySelector('.quiz-btn.primary').disabled = !checkbox.checked;
            });
        } else if (question.type === 'file-upload') {
            this.setupFileUpload();
        }
    },
    
    // Handle single option selection
    selectSingleOption(element) {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        element.classList.add('selected');
        document.querySelector('.quiz-btn.primary').disabled = false;
    },
    
    // Handle multi option selection
    selectMultiOption(element) {
        element.classList.toggle('selected');
    },
    
    // Setup file upload
    setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        
        fileUploadArea.onclick = () => fileInput.click();
        
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                const fileNames = Array.from(e.target.files).map(f => f.name).join(', ');
                fileUploadArea.innerHTML = `<p>Selected: ${fileNames}</p>`;
            }
        };
        
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
                const fileNames = Array.from(e.dataTransfer.files).map(f => f.name).join(', ');
                fileUploadArea.innerHTML = `<p>Selected: ${fileNames}</p>`;
            }
        };
    },
    
    // Handle answer submission
    handleAnswer() {
        const question = this.config.questions[this.currentQuestionIndex];
        
        // Collect answer based on question type
        let answer = null;
        
        switch (question.type) {
            case 'single-select':
                const selected = document.querySelector('.quiz-option.selected');
                if (selected) {
                    answer = selected.dataset.value;
                }
                break;
                
            case 'multi-select':
                const selectedMulti = document.querySelectorAll('.quiz-option.selected');
                answer = Array.from(selectedMulti).map(opt => opt.dataset.value);
                break;
                
            case 'text-input':
                answer = document.getElementById('textInput').value;
                break;
                
            case 'date-selector':
                const month = document.getElementById('monthInput').value;
                const day = document.getElementById('dayInput').value;
                const year = document.getElementById('yearInput').value;
                answer = `${month}/${day}/${year}`;
                break;
                
            case 'file-upload':
                const fileInput = document.getElementById('fileInput');
                answer = fileInput.files.length > 0 ? 'uploaded' : null;
                break;
                
            case 'checkbox':
                answer = document.getElementById('termsCheckbox').checked;
                break;
        }
        
        // Save answer if provided
        if (answer !== null && answer !== '' && question.id !== 'welcome' && question.id !== 'complete') {
            State.addQuizAnswer(question.id, answer);
        
            // Mark related action subtypes as completed
            this.markRelatedActionsComplete(question.id, answer);
            
            // Check if this unlocks any scholarships
            this.checkScholarshipUnlocks(question.id);
        }
        
        // Determine next question
        let nextQuestionId = null;
        
        if (typeof question.next === 'function') {
            // Handle function-based branching (from embedded config)
            nextQuestionId = question.next(State.appState.quizAnswers);
        } else if (question.next === 'conditional' && question.conditionalNext) {
            // Handle JSON-based conditional branching
            const condition = question.conditionalNext.condition;
            const answerValue = State.appState.quizAnswers[condition];
            const branches = question.conditionalNext.branches;
            
            // Find matching branch or use default
            nextQuestionId = branches[answerValue] || branches.default || null;
        } else {
            // Simple next question ID
            nextQuestionId = question.next;
        }
        
        // Load next question or close quiz
        if (nextQuestionId) {
            const nextIndex = this.config.questions.findIndex(q => q.id === nextQuestionId);
            if (nextIndex >= 0) {
                this.loadQuestion(nextIndex);
            } else {
                this.close();
            }
        } else {
            this.close();
        }
    },

    markRelatedActionsComplete(questionId, answer) {
        // Map quiz questions to action subtypes they satisfy
        const completionMap = {
            'gpa': ['Confirm GPA requirement'],
            'year': ['Verify enrollment status'],
            'major': ['Confirm major/field of study'],
            'financialNeed': ['Update financial information'],
            'extracurriculars': ['Add extracurricular activities']
        };
        
        const completedSubtypes = completionMap[questionId];
        if (completedSubtypes) {
            completedSubtypes.forEach(subtype => {
                // Determine action type from subtype
                const actionType = this.getActionTypeForSubtype(subtype);
                State.completeAction(actionType, subtype);
            });
            
            // Remove these from action queue immediately
            State.appState.actions = State.appState.actions.filter(a => 
                !completedSubtypes.includes(a.subtype)
            );
            UI.renderActions();
        }
    },

    // Add this function to Quiz.js
    getActionTypeForSubtype(subtype) {
        // Map subtypes back to their action types
        const subtypeToActionMap = {
            // confirmEligibility subtypes
            'Confirm GPA requirement': 'confirmEligibility',
            'Verify enrollment status': 'confirmEligibility',
            'Confirm major/field of study': 'confirmEligibility',
            'Verify citizenship status': 'confirmEligibility',
            
            // updateProfile subtypes
            'Complete basic information': 'updateProfile',
            'Add academic history': 'updateProfile',
            'Update financial information': 'updateProfile',
            'Add extracurricular activities': 'updateProfile',
            
            // uploadDocument subtypes
            'Upload transcript (unofficial)': 'uploadDocument',
            'Upload transcript (official)': 'uploadDocument',
            'Upload recommendation letter': 'uploadDocument',
            'Upload financial aid form': 'uploadDocument',
            'Upload proof of enrollment': 'uploadDocument'
        };
        
        return subtypeToActionMap[subtype] || null;
    },
    
    // Skip current question
    skipQuestion() {
        const question = this.config.questions[this.currentQuestionIndex];
        
        // Move to next question
        let nextQuestionId = null;
        
        if (typeof question.next === 'function') {
            nextQuestionId = question.next(State.appState.quizAnswers);
        } else {
            nextQuestionId = question.next;
        }
        
        if (nextQuestionId) {
            const nextIndex = this.config.questions.findIndex(q => q.id === nextQuestionId);
            if (nextIndex >= 0) {
                this.loadQuestion(nextIndex);
            }
        }
    },
    
    // Check if answer unlocks scholarships
    checkScholarshipUnlocks(questionId) {
        State.appState.scholarships.forEach(scholarship => {
            if (scholarship.state.includes('actionRequired') && 
                scholarship.quizUnlock === questionId) {
                // Unblock scholarship
                setTimeout(() => Scholarship.progress(scholarship), 100);
            }
        });
    },
    
    // Close quiz modal
    close() {
        UI.closeModal('quizModal');
        State.appState.isPaused = false;
        
        // Remove the initial quiz action specifically
        State.appState.actions = State.appState.actions.filter(a => 
            a.type !== 'startQuiz' && 
            a.title !== 'Update profile to confirm matches'
        );
        
        // Check ALL scholarships for unlocks, including the first one
        State.appState.scholarships.forEach(scholarship => {
            if (scholarship.state.includes('actionRequired:confirmEligibility')) {
                // Check if quiz answered the unlock requirement
                if (scholarship.quizUnlock && State.appState.quizAnswers[scholarship.quizUnlock]) {
                    scholarship.state = 'matchFound';
                    scholarship.progress = 50;
                    UI.updateScholarshipDisplay(scholarship);
                    setTimeout(() => Scholarship.progress(scholarship), 100);
                }
            }
        });
        
        // After quiz is finished
        const firstScholarship = State.appState.scholarships.find(s => s.isFirst);
        if (firstScholarship) {
            Scholarship.progress(firstScholarship);
        }
        
        UI.renderActions();
        
        // Remove spotlight
        if (CONFIG.enableSpotlight) {
            UI.removeSpotlight();
        }
    }
};