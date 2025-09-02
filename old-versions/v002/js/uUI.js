// js/UI.js - User Interface Module

const UI = {
    // Start the searching animation
    startSearchingAnimation() {
        let dots = 0;
        this.searchInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            const ellipses = document.getElementById('ellipses');
            if (ellipses) {
                ellipses.textContent = '.'.repeat(dots || 1);
            }
        }, 500);
    },
    
    // Stop searching animation
    stopSearchingAnimation() {
        if (this.searchInterval) {
            clearInterval(this.searchInterval);
        }
    },
    
    // Create scholarship element
    createScholarshipElement(scholarship) {
        const div = document.createElement('div');
        div.className = 'scholarship-box';
        div.id = `scholarship-${scholarship.id}`;
        
        const statusClass = this.getStatusClass(scholarship.state);
        const deadlineClass = scholarship.deadline <= 7 ? 'urgent' : '';
        
        div.innerHTML = `
            <div class="scholarship-header">
                <div class="scholarship-name">${scholarship.name}</div>
                <div class="scholarship-amount">$${scholarship.amount.toLocaleString()}</div>
            </div>
            <div class="scholarship-status">
                <div class="status-text ${statusClass}">${this.formatState(scholarship.state)}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${scholarship.progress}%"></div>
                </div>
            </div>
            <div class="scholarship-deadline ${deadlineClass}">Deadline in ${scholarship.deadline} days</div>
        `;
        
        return div;
    },
    
    // Smooth update for scholarship progress without recreating element
    updateScholarshipProgress(scholarship) {
        const element = document.getElementById(`scholarship-${scholarship.id}`);
        if (!element) {
            // Element doesn't exist, create it
            return this.createScholarshipElement(scholarship);
        }
        
        // Update status text
        const statusText = element.querySelector('.status-text');
        const oldStatusClass = statusText.className.replace('status-text', '').trim();
        const newStatusClass = this.getStatusClass(scholarship.state);
        
        if (oldStatusClass !== newStatusClass) {
            // Fade transition for status text change
            statusText.style.opacity = '0';
            setTimeout(() => {
                statusText.className = `status-text ${newStatusClass}`;
                statusText.textContent = this.formatState(scholarship.state);
                statusText.style.opacity = '1';
            }, CONFIG.animations.statusFadeTime || 200);
        } else if (statusText.textContent !== this.formatState(scholarship.state)) {
            // Just update text if class hasn't changed
            statusText.textContent = this.formatState(scholarship.state);
        }
        
        // Animate progress bar
        const progressFill = element.querySelector('.progress-fill');
        const currentWidth = parseFloat(progressFill.style.width) || 0;
        const targetWidth = scholarship.progress;
        
        // Only animate if progress changed
        if (currentWidth !== targetWidth) {
            // Add smooth transition if not already present
            if (!progressFill.style.transition) {
                progressFill.style.transition = `width ${CONFIG.animations.progressBarDuration || 500}ms ${CONFIG.animations.progressBarEasing || 'ease-out'}`;
            }
            
            // Special effects for certain milestones
            if (targetWidth === 100) {
                // Completion animation
                progressFill.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
                element.style.animation = `${CONFIG.animations.completionPulse || 'pulse'} 0.5s ease`;
            } else if (targetWidth >= 90) {
                // Near completion
                progressFill.style.background = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
            } else if (targetWidth >= 50 && currentWidth < 50) {
                // Crossed halfway milestone
                element.style.animation = `${CONFIG.animations.milestonePulse || 'pulse'} 0.3s ease`;
            }
            
            // Update width
            progressFill.style.width = `${targetWidth}%`;
            
            // Add progress number indicator if configured
            if (CONFIG.features.showProgressNumbers) {
                let progressIndicator = element.querySelector('.progress-indicator');
                if (!progressIndicator) {
                    progressIndicator = document.createElement('span');
                    progressIndicator.className = 'progress-indicator';
                    progressFill.parentElement.appendChild(progressIndicator);
                }
                progressIndicator.textContent = `${targetWidth}%`;
                progressIndicator.style.opacity = '1';
                setTimeout(() => {
                    progressIndicator.style.opacity = '0';
                }, CONFIG.animations.progressNumberDuration || 2000);
            }
        }
        
        // Update amount if changed (for dynamic scholarships)
        const amountElement = element.querySelector('.scholarship-amount');
        const currentAmount = amountElement.textContent.replace(/[\$,]/g, '');
        if (parseInt(currentAmount) !== scholarship.amount) {
            amountElement.style.transform = 'scale(1.1)';
            amountElement.textContent = `$${scholarship.amount.toLocaleString()}`;
            setTimeout(() => {
                amountElement.style.transform = 'scale(1)';
            }, 300);
        }
        
        // Update deadline urgency if needed
        const deadlineElement = element.querySelector('.scholarship-deadline');
        const shouldBeUrgent = scholarship.deadline <= 7;
        const isCurrentlyUrgent = deadlineElement.classList.contains('urgent');
        
        if (shouldBeUrgent !== isCurrentlyUrgent) {
            if (shouldBeUrgent) {
                deadlineElement.classList.add('urgent');
                // Flash animation for new urgency
                deadlineElement.style.animation = 'flash 0.5s ease 2';
            } else {
                deadlineElement.classList.remove('urgent');
            }
        }
        deadlineElement.textContent = `Deadline in ${scholarship.deadline} days`;
        
        // Return element for chaining
        return element;
    },

    // Update a scholarship card
    updateScholarshipDisplay(scholarship) {
        // Try smooth update first
        const element = this.updateScholarshipProgress(scholarship);
        
        // If element still doesn't exist or needs full recreation
        if (!element || scholarship.forceRecreate) {
            const container = document.getElementById('liveFeedContent');
            const newElement = this.createScholarshipElement(scholarship);
            
            if (element) {
                element.replaceWith(newElement);
            } else {
                container.appendChild(newElement);
            }
        }
    },
    
    // Add scholarship to feed
    addScholarshipToFeed(scholarship) {
        const liveFeedContent = document.getElementById('liveFeedContent');
        const searchingDiv = document.createElement('div');
        searchingDiv.className = 'scholarship-box';
        searchingDiv.style.opacity = '0.5';
        searchingDiv.innerHTML = '<div class="searching-text">Searching for scholarships...</div>';
        
        liveFeedContent.insertBefore(searchingDiv, liveFeedContent.firstChild);
        
        setTimeout(() => {
            const scholarshipElement = this.createScholarshipElement(scholarship);
            searchingDiv.replaceWith(scholarshipElement);
            scholarshipElement.style.animation = 'fadeInDown 0.4s ease-out';
        }, 1000);
        
        // Limit visible scholarships
        this.trimFeed();
    },
    
    // Trim feed to max visible scholarships
    trimFeed() {
        const liveFeedContent = document.getElementById('liveFeedContent');
        const scholarships = liveFeedContent.querySelectorAll('.scholarship-box');
        
        if (scholarships.length > CONFIG.maxVisibleScholarships) {
            // Apply gradual darkening to older items
            scholarships.forEach((el, index) => {
                if (index >= CONFIG.maxVisibleScholarships - 3) {
                    const opacity = 1 - ((index - CONFIG.maxVisibleScholarships + 3) * 0.2);
                    el.style.opacity = Math.max(opacity, 0.3);
                }
            });
            
            // Remove excess items
            for (let i = scholarships.length - 1; i >= CONFIG.maxVisibleScholarships; i--) {
                scholarships[i].remove();
            }
        }
    },
    
    // Create action box element
    createActionElement(action) {
        const div = document.createElement('div');
        div.className = `action-box ${action.priority ? 'priority' : ''} ${action.spotlight ? 'spotlight' : ''}`;
        div.id = action.isFirst ? 'updateProfileAction' : `action-${action.id}`;
        div.onclick = action.onclick;
        
        // Count scholarships needing this action
        const count = action.scholarshipCount || State.appState.scholarships.filter(s => 
            s.state.includes(action.type)
        ).length || 1;
        
        div.innerHTML = `
            <div class="action-content">
                <div class="action-left">
                    <div class="action-title">${action.title}</div>
                    <div class="action-buttons">
                        <button class="action-btn primary" onclick="event.stopPropagation();">Start</button>
                        ${action.type !== 'sendApplications' ? 
                            `<button class="action-btn secondary" onclick="event.stopPropagation(); Event.skipAction('${action.id}')">Later</button>` : ''}
                    </div>
                </div>
                <div class="action-meta">
                    ${count > 1 ? `<div class="action-count">${count} scholarships need this</div>` : ''}
                    ${action.deadline ? `<div class="action-deadline">Due in ${action.deadline} days</div>` : ''}
                </div>
            </div>
        `;
        
        // Add proper click handler to Start button
        const startBtn = div.querySelector('.action-btn.primary');
        startBtn.onclick = (e) => {
            e.stopPropagation();
            action.onclick();
        };
        
        return div;
    },
    
    // Render actions in queue
    renderActions() {
        const actionQueue = document.getElementById('actionQueueContent');
        actionQueue.innerHTML = '';
        
        // Separate sticky and regular actions
        const stickyActions = State.appState.actions.filter(a => a.sticky);
        const regularActions = State.appState.actions.filter(a => !a.sticky);
        
        // Sort regular actions by deadline
        regularActions.sort((a, b) => {
            if (a.deadline && b.deadline) {
                return a.deadline - b.deadline;
            }
            return a.timestamp - b.timestamp;
        });
        
        // Render sticky first, then regular
        [...stickyActions, ...regularActions].forEach(action => {
            const actionElement = this.createActionElement(action);
            if (action.sticky) {
                actionElement.classList.add('sticky-action');
            }
            actionQueue.appendChild(actionElement);
        });
    },
    
    // Toggle feed expansion
    toggleFeed(type) {
        const liveSection = document.getElementById('liveFeedSection');
        const actionSection = document.getElementById('actionQueueSection');
        
        if (type === 'live') {
            if (liveSection.classList.contains('collapsed')) {
                liveSection.classList.remove('collapsed');
                liveSection.classList.add('expanded');
                actionSection.classList.remove('expanded');
                actionSection.classList.add('collapsed');
            }
        } else {
            if (actionSection.classList.contains('collapsed')) {
                actionSection.classList.remove('collapsed');
                actionSection.classList.add('expanded');
                liveSection.classList.remove('expanded');
                liveSection.classList.add('collapsed');
            }
        }
    },
    
    // Apply spotlight effect
    applySpotlight(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const dimOverlay = document.getElementById('dimOverlay');
        dimOverlay.classList.add('active', 'spotlight');
        
        // Calculate spotlight position
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        dimOverlay.style.setProperty('--spotlight-x', `${x}px`);
        dimOverlay.style.setProperty('--spotlight-y', `${y}px`);
        
        // Make the element clickable through the overlay
        element.style.position = 'relative';
        element.style.zIndex = '1001';
        
        // Pause feed if configured
        if (CONFIG.pauseAllProgressOnAction) {
            State.pauseAllProgress(true);
        }
        if (CONFIG.pauseNewScholarshipsOnAction) {
            State.pauseNewScholarships(true);
        }
    },
    
    // Remove spotlight effect
    removeSpotlight() {
        const dimOverlay = document.getElementById('dimOverlay');
        dimOverlay.classList.remove('active', 'spotlight');
        
        // Reset element z-index
        const spotlightElements = document.querySelectorAll('.spotlight');
        spotlightElements.forEach(el => {
            el.style.position = '';
            el.style.zIndex = '';
        });
        
        // Resume feed if it was paused
        State.pauseAllProgress(false);
        State.pauseNewScholarships(false);
    },
    
    // Open modal
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    // Close modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    // Format state for display
    formatState(state) {
        const stateMap = {
            'scanning': 'Scanning eligibility criteria...',
            'checkingDeadline': 'Checking deadline...',
            'checkingEligibility': 'Verifying eligibility...',
            'actionRequired:confirmEligibility': '⚠️ Action required: Confirm eligibility',
            'actionRequired:uploadDocument': '⚠️ Action required: Upload document',
            'actionRequired:updateProfile': '⚠️ Action required: Update profile',
            'notEligible': '❌ Not eligible',
            'deadlinePassed': '❌ Deadline passed',
            'matchFound': '✅ Match found!',
            'gettingRequirements': 'Getting requirements...',
            'preparingMaterials': 'Preparing materials...',
            'writingEssay': 'Writing essay...',
            'finalizingApplication': 'Finalizing application...',
            'readyToSubmit': '✅ Ready to submit',
            'applicationSubmitted': '✅ Application submitted!'
        };
        
        return stateMap[state] || state;
    },
    
    // Get status class for styling
    getStatusClass(state) {
        if (state.includes('actionRequired')) return 'action-required';
        if (['notEligible', 'deadlinePassed'].includes(state)) return 'failed';
        if (['matchFound', 'readyToSubmit', 'applicationSubmitted'].includes(state)) return 'success';
        return '';
    },
    
    // Show metric update animation
    animateMetricUpdate(metricElement) {
        metricElement.classList.add('updating');
        setTimeout(() => {
            metricElement.classList.remove('updating');
        }, 300);
    }
};
