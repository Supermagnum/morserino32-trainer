'use strict';

const log = require('loglevel');

class KochMorseTutor {
    constructor(morsePlayer, inputHandler) {
        this.morsePlayer = morsePlayer;
        this.inputHandler = inputHandler;
        this.currentLesson = 0;
        this.lessonCharacters = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X';
        this.speed = 15; // Default speed
        this.groupSize = 5; // Default group size
        this.displayElement = document.getElementById('kochTutorDisplay');
        this.currentCharElement = document.getElementById('currentCharacter');
        this.groupResultElement = document.getElementById('groupResult');
        this.speedControlElement = document.getElementById('speedControl');
        this.speedDisplayElement = document.getElementById('speedDisplay');

        this.initializeUI();
    }

    initializeUI() {
        if (this.speedControlElement) {
            this.speedControlElement.addEventListener('input', (event) => {
                this.setSpeed(parseInt(event.target.value));
            });
        }
    }

    startLesson() {
        log.info('Starting Koch Method lesson');
        this.displayElement.style.display = 'block';
        this.playNextGroup();
    }

    async playNextGroup() {
        let group = '';
        for (let i = 0; i < this.groupSize; i++) {
            group += this.lessonCharacters[Math.floor(Math.random() * (this.currentLesson + 1))];
        }
        
        this.currentCharElement.textContent = group;
        await this.morsePlayer.playMorse(group);
        
        const userInput = await this.inputHandler.getInput();
        this.checkInput(group, userInput);
    }

    checkInput(expected, actual) {
        let result = '';
        for (let i = 0; i < expected.length; i++) {
            if (i < actual.length) {
                if (expected[i].toLowerCase() === actual[i].toLowerCase()) {
                    result += `<span class="correct">${expected[i]}</span>`;
                } else {
                    result += `<span class="wrong">${expected[i]}</span>`;
                }
            } else {
                result += `<span class="missing">${expected[i]}</span>`;
            }
        }
        this.groupResultElement.innerHTML = result;

        if (expected.toLowerCase() === actual.toLowerCase()) {
            log.info('Correct!');
            if (Math.random() < 0.2) { // 20% chance to advance to next lesson
                this.currentLesson = Math.min(this.currentLesson + 1, this.lessonCharacters.length - 1);
            }
        } else {
            log.info('Incorrect. Try again.');
        }
        
        setTimeout(() => this.playNextGroup(), 9000); // Wait 9 seconds before next group
    }

    setSpeed(speed) {
        this.speed = speed;
        this.morsePlayer.setWpm(speed);
        if (this.speedDisplayElement) {
            this.speedDisplayElement.textContent = speed;
        }
        log.info(`Speed set to ${speed} WPM`);
    }

    setGroupSize(size) {
        this.groupSize = size;
        log.info(`Group size set to ${size}`);
    }
}

module.exports = KochMorseTutor;
