// js/Metrics.js - Metrics Management Module

const Metrics = {
    updateInterval: null,
    
    // Initialize metrics display
    initialize() {
        this.update();
        this.updateInterval = setInterval(() => this.update(), 1000);
    },
    
    // Update all metrics
    update() {
        const metrics = State.appState.metrics;
        const scholarships = State.appState.scholarships;
        
        // Calculate matches
        metrics.matches = scholarships.filter(s => 
            ['matchFound', 'gettingRequirements', 'preparingMaterials', 'writingEssay', 
             'finalizingApplication', 'readyToSubmit', 'applicationSubmitted'].includes(s.state) ||
            s.state.includes('actionRequired:upload') || s.state.includes('actionRequired:update')
        ).length;
        
        // Calculate potential awards
        metrics.potentialAwards = scholarships
            .filter(s => !['notEligible', 'deadlinePassed'].includes(s.state))
            .reduce((sum, s) => sum + s.amount, 0);
        
        // Calculate applications started
        metrics.applicationsStarted = scholarships.filter(s =>
            ['preparingMaterials', 'writingEssay', 'finalizingApplication', 'readyToSubmit', 'applicationSubmitted'].includes(s.state) ||
            s.state.includes('actionRequired:upload') || s.state.includes('actionRequired:update')
        ).length;
        
        // Calculate ready to apply
        metrics.readyToApply = scholarships.filter(s => s.state === 'readyToSubmit').length;
        
        // Find next deadline
        const upcomingDeadlines = scholarships
            .filter(s => !['notEligible', 'deadlinePassed', 'applicationSubmitted'].includes(s.state))
            .map(s => s.deadline)
            .sort((a, b) => a - b);
        
        metrics.nextDeadline = upcomingDeadlines[0] || null;
        
        // Update state
        State.updateMetrics(metrics);
        
        // Render metrics
        this.render();
        
        // Check if ready to show paywall
        this.checkPaywallTrigger();
    },
    
    // Render metrics to UI
    render() {
        const metrics = State.appState.metrics;
        const metricsGrid = document.getElementById('metricsGrid');
        
        const currentValues = {};
        metricsGrid.querySelectorAll('.metric-box').forEach(box => {
            const label = box.querySelector('.metric-label').textContent;
            const value = box.querySelector('.metric-value').textContent;
            currentValues[label] = value;
        });
        
        const newHTML = `
            <div class="metric-box">
                <div class="metric-value">${metrics.matches}</div>
                <div class="metric-label">Matches</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">$${this.formatAmount(metrics.potentialAwards)}</div>
                <div class="metric-label">Potential</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${metrics.applicationsStarted}</div>
                <div class="metric-label">Started</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${metrics.readyToApply}</div>
                <div class="metric-label">Ready</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${metrics.nextDeadline ? metrics.nextDeadline + 'd' : 'N/A'}</div>
                <div class="metric-label">Next Due</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${this.formatTime(metrics.timeSaved)}</div>
                <div class="metric-label">Time Saved</div>
            </div>
        `;
        
        metricsGrid.innerHTML = newHTML;
        
        // Animate changed values
        metricsGrid.querySelectorAll('.metric-box').forEach(box => {
            const label = box.querySelector('.metric-label').textContent;
            const value = box.querySelector('.metric-value').textContent;
            if (currentValues[label] && currentValues[label] !== value) {
                UI.animateMetricUpdate(box.querySelector('.metric-value'));
            }
        });
    },
    
    // Format amount for display
    formatAmount(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(amount >= 10000 ? 0 : 1) + 'K';
        }
        return amount.toString();
    },
    
    // Format time for display
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    },
    
    // Check if paywall should be triggered
    checkPaywallTrigger() {
        const metrics = State.appState.metrics;
        
        // Check if we should show paywall
        if (metrics.readyToApply >= 3 && !State.appState.actions.find(a => a.type === 'sendApplications')) {
            const totalAmount = State.appState.scholarships
                .filter(s => s.state === 'readyToSubmit')
                .reduce((sum, s) => sum + s.amount, 0);
            
            setTimeout(() => {
                Event.addAction({
                    type: 'sendApplications',
                    title: `Send out ${metrics.readyToApply} applications for $${this.formatAmount(totalAmount)}`,
                    priority: true,
                    onclick: () => Event.openPaywall()
                });
            }, 2000);
        }
    }
};