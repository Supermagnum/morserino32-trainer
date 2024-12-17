const log = require('loglevel');

class KochMorseTutor {
    constructor(morsePlayer, inputHandler) {
        this.morsePlayer = morsePlayer;
        this.inputHandler = inputHandler;
        this.lessonOrder = ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I', '.', 'N', 'J', 'E', 'F', '0', 'Y', 'V', ',', 'G', '5', '/', 'Q', '9', 'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C', '1', 'D', '6', 'X', '<BT>', '<SK>', '<AR>'];
        this.currentLesson = [];
        this.groupSize = 5;
        this.correctGroups = 0;
        this.totalGroups = 0;
        this.userProgress = this.loadProgress();
        this.characterDisplay = document.getElementById('currentCharacter');
        this.resultDisplay = document.getElementById('groupResult');
        this.farnsworthTiming = 1000;
        this.speed = 15;
        this.speedControl = document.getElementById('speedControl');
        this.speedDisplay = document.getElementById('speedDisplay');
        this.initSpeedControl();
    }

    showTutorDisplay(show) {
        const display = document.getElementById('kochTutorDisplay');
        if (display) {
            display.style.display = show ? 'block' : 'none';
        } else {
            log.error("Tutor display element not found");
        }
    }

    async startLesson() {
        this.showTutorDisplay(true);
        
        while (this.currentLesson.length < this.lessonOrder.length) {
            await this.introduceNewCharacter();
            await this.practiceCurrentLesson();
            
            if (!await this.confirmContinue()) {
                break;
            }
        }

        if (this.currentLesson.length === this.lessonOrder.length) {
            log.info("Congratulations! All characters learned!");
        } else {
            log.info("Lesson ended. Progress saved.");
        }

        this.endLesson();
    }

    async confirmContinue() {
        return new Promise((resolve) => {
            const continueButton = document.createElement('button');
            continueButton.textContent = 'Continue to next character';
            continueButton.onclick = () => {
                continueButton.remove();
                resolve(true);
            };

            const stopButton = document.createElement('button');
            stopButton.textContent = 'Stop for now';
            stopButton.onclick = () => {
                stopButton.remove();
                resolve(false);
            };

            this.resultDisplay.appendChild(continueButton);
            this.resultDisplay.appendChild(stopButton);
        });
    }

    endLesson() {
        this.showTutorDisplay(false);
        this.saveProgress();
    }

    async introduceNewCharacter() {
        const newChar = this.lessonOrder[this.currentLesson.length];
        this.currentLesson.push(newChar);
        log.info(`Introducing new character: ${newChar}`);
        this.resultDisplay.innerHTML = '';
        
        this.displayCharacter(newChar);
        
        const startTime = Date.now();
        while (Date.now() - startTime < 30000) {
            await this.morsePlayer.playMorse(newChar);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    initSpeedControl() {
        if (this.speedControl && this.speedDisplay) {
            this.speedControl.min = 15;
            this.speedControl.value = this.speed;
            this.speedDisplay.textContent = this.speed;
            this.speedControl.addEventListener('input', () => {
                this.setSpeed(parseInt(this.speedControl.value));
            });
        } else {
            log.error("Speed control elements not found");
        }
    }

    setSpeed(newSpeed) {
        if (newSpeed >= 15) {
            this.speed = newSpeed;
            this.speedDisplay.textContent = this.speed;
            this.farnsworthTiming = Math.max(0, 1000 - (this.speed - 15) * 50);
            if (this.m32CommunicationService) {
                this.m32CommunicationService.sendM32Command(`PUT speed/${this.speed}`, false);
            }
        }
    }

    async practiceCurrentLesson() {
        const maxAttempts = 30;
        let attempts = 0;

        while ((this.correctGroups / this.totalGroups < 0.9 || this.totalGroups < 10) && attempts < maxAttempts) {
            attempts++;
            const group = this.generateRandomGroup();
            log.info(`Practice group: ${group}`);
            
            for (let char of group) {
                try {
                    await this.morsePlayer.playMorse(char, this.speed);
                    await new Promise(resolve => setTimeout(resolve, this.farnsworthTiming));
                } catch (error) {
                    log.error(`Error playing morse for character ${char}: ${error}`);
                }
            }

            const userInput = await this.inputHandler.getUserInput(5);

            this.displayResults(group, userInput);

            this.totalGroups++;
            if (group === userInput) {
                this.correctGroups++;
            }
        }

        if (attempts >= maxAttempts) {
            log.info("Maximum attempts reached. Resetting practice session.");
            this.resetPracticeSession();
        }
    }

    resetPracticeSession() {
        this.totalGroups = 0;
        this.correctGroups = 0;
    }

    generateRandomGroup() {
        let group = '';
        for (let i = 0; i < this.groupSize; i++) {
            group += this.currentLesson[Math.floor(Math.random() * this.currentLesson.length)];
        }
        return group;
    }

    displayCharacter(char) {
        if (this.characterDisplay) {
            this.characterDisplay.textContent = char;
            this.characterDisplay.style.fontSize = '48px';
            this.characterDisplay.style.fontWeight = 'bold';
            this.characterDisplay.style.marginBottom = '20px';
        } else {
            log.error("Character display element not found");
        }
    }

    displayResults(correct, user) {
        if (!this.resultDisplay) {
            log.error("Result display element not found");
            return;
        }

        this.resultDisplay.innerHTML = '';

        for (let i = 0; i < correct.length; i++) {
            const span = document.createElement('span');
            span.textContent = user[i] || ' ';
            
            span.style.color = user[i] === correct[i] ? 'green' : 'red';
            span.style.fontSize = '24px';
            span.style.marginRight = '5px';
            this.resultDisplay.appendChild(span);
        }

        if (correct !== user) {
            const correctAnswer = document.createElement('div');
            correctAnswer.textContent = `Correct: ${correct}`;
            correctAnswer.style.marginTop = '10px';
            this.resultDisplay.appendChild(correctAnswer);
        }

        this.updateProgress();
    }

    updateProgress() {
        const progressPercentage = (this.correctGroups / this.totalGroups) * 100 || 0;
        const progressElement = document.createElement('div');
        progressElement.textContent = `Progress: ${progressPercentage.toFixed(2)}% (${this.correctGroups}/${this.totalGroups})`;
        this.resultDisplay.appendChild(progressElement);
    }

    loadProgress() {
        const progress = localStorage.getItem('kochMorseTutorProgress');
        return progress ? JSON.parse(progress) : { lastLesson: 0 };
    }

    saveProgress() {
        this.userProgress.lastLesson = this.currentLesson.length;
        localStorage.setItem('kochMorseTutorProgress', JSON.stringify(this.userProgress));
    }
}

module.exports = KochMorseTutor;
