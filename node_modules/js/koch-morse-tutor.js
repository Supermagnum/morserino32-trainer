'use strict';

const log = require('loglevel');

const { EVENT_M32_TEXT_RECEIVED } = require('./m32-communication-service');

class KochMorseTutor {
    constructor(m32CommunicationService, inputHandler) {
        this.morsePlayer = new jscw();
        this.inputHandler = inputHandler;
        this.currentLesson = 0;
        this.lessonCharacters = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X';
        this.speed = 15; // Default speed
        this.groupSize = 5; // Default group size
        this.displayElement = document.getElementById('kochDisplay');
        this.currentCharElement = document.getElementById('currentChar');
        this.groupResultElement = document.getElementById('kochResult');
        this.speedControlElement = document.getElementById('kochSpeedControl');
        this.speedDisplayElement = document.getElementById('kochSpeedDisplay');
        this.displayOptionElement = document.getElementById('kochDisplayOption');
        this.inputElement = document.getElementById('kochInput');

        this.m32CommunicationService = m32CommunicationService;

        // Flexible pause settings
        this.standardPause = 1; // Standard pause between characters at high speeds (in seconds)
        this.maxPause = 5; // Maximum pause at low speeds (in seconds)
        this.transitionSpeed = 18; // WPM at which we reach standard pause

        // Farnsworth timing
        this.useFarnsworth = false;
        this.farnsworthSpeed = 18; // Character speed for Farnsworth timing
        this.farnsworthToggleElement = document.getElementById('farnsworthToggle');
        this.farnsworthSpeedElement = document.getElementById('farnsworthSpeed');
        this.farnsworthSpeedDisplayElement = document.getElementById('farnsworthSpeedDisplay');

        this.initializeUI();
        this.setMorseSpeed(this.speed);

        this.activeMode = false;
    }

            

    initializeUI() {
        if (this.speedControlElement) {
            this.speedControlElement.addEventListener('input', (event) => {
                this.setMorseSpeed(parseInt(event.target.value));
                this.speedDisplayElement.innerText = this.speedControlElement.value;
            });
        }

        if (this.farnsworthToggleElement) {
            this.farnsworthToggleElement.addEventListener('change', (event) => {
                this.setFarnsworth(event.target.checked);
            });
        }

        if (this.farnsworthSpeedElement) {
            this.farnsworthSpeedElement.addEventListener('input', (event) => {
                this.setFarnsworthSpeed(parseInt(event.target.value));
            });
        }
    }

    // sets speed of morse
    setMorseSpeed(speed) {
        this.speed = speed;
        this.dit = 1200 / speed;
        this.dah = this.dit * 3;
        this.pauseBetweenLetters = this.dit * 3;
        this.pauseBetweenWords = this.dit * 7;
        console.log(`Speed set to ${speed} WPM`);
    }

    startLesson() {
        console.log('Starting Koch Method lesson');
        this.displayElement.style.display = 'block';
        //this.morsePlayer.init();
        this.playNextGroup();
        this.inputElement.focus();
    }

    async playNextGroup() {
        let group = '';
        for (let i = 0; i < this.groupSize; i++) {
            group += this.lessonCharacters[Math.floor(Math.random() * (this.currentLesson + 1))];
        }

        let noKM = /[A-J]|[L]|[N-Z]/;
        let noKMResult;

        console.log(this.displayOptionElement.checked);
        
        if(this.displayOptionElement.checked)
        {
            console.log("Hi!")
            noKMResult = group.match(noKM);
            this.currentCharElement.textContent = noKMResult;
        }
        //this.currentCharElement.textContent = group;
        await this.morsePlayer.play(group);
        
        const userInput = await this.getInput();
        console.log("Is this working?" + " "  + userInput);
        this.checkInput(group, userInput);
        //debugger
    }

    textReceived(value) {
        if (this.activeMode) {
            this.inputElement.value += value;
        }
    }

    getInput()
    {
        return new Promise((resolve) => {
            const keyInputs = [];
            this.inputElement.addEventListener('keydown', (event) => {
                //debugger
                const keyInput = event.key;
                //let numInput = 0;
                if(keyInput != 'Backspace' && keyInput != ' ' && keyInput != 'F1' && keyInput != 'F11')
                {
                    keyInputs.push(keyInput);
                }
                else
                {
                    event.preventDefault()
                    return false;
                }
                let result = keyInputs.join("");
                if(this.inputElement.value)
                {
                    this.inputElement.value = "";
                }
                if(result.length == 5)
                {
                    resolve(result);
                }
                

                //const keyInput = event.key;
                console.log(keyInput + ' was pressed!');
                //resolve(console.log(keyInput + ' was pressed!'));
                //resolve(keyInputs[numInput]);
            })
            //console.log(keyInputs);
            this.inputElement.addEventListener('keyup', (e) => {
                e = this.inputElement.setSelectionRange(0,0);
            })

            this.m32CommunicationService.addEventListener(EVENT_M32_TEXT_RECEIVED, this.textReceived.bind(this));
        })
    }

    checkInput(expected, actual) {
        //debugger
        let result = '';
        console.log(expected.length);
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
            console.log('Correct!');
            //if (Math.random() < 0.2) { // 20% chance to advance to next lesson
                this.currentLesson = Math.min(this.currentLesson + 1, this.lessonCharacters.length - 1);
            //}
        } else {
            console.log('Incorrect. Try again.');
        }
        
        setTimeout(() => this.playNextGroup(), 3000); // Wait 3 seconds before next group
    }

    setSpeed(speed) {
        //debugger
        this.speed = speed;
        const pause = this.calculatePause(speed);
        if (this.useFarnsworth) {
            this.morsePlayer.setWpm(this.farnsworthSpeed);
            this.morsePlayer.setEffectiveWpm(speed);
        } else {
            this.morsePlayer.setWpm(speed);
        }
        //this.morsePlayer.setCharacterPause(pause);
        if (this.speedDisplayElement) {
            this.speedDisplayElement.textContent = speed;
        }
        console.log(`Speed set to ${speed} WPM, character pause: ${pause.toFixed(2)} seconds, Farnsworth: ${this.useFarnsworth}`);
    }

    calculatePause(speed) {
        if (this.useFarnsworth) {
            // Use a fixed pause for Farnsworth timing
            return this.standardPause;
        } else if (speed >= this.transitionSpeed) {
            return this.standardPause;
        } else {
            // Linear interpolation between maxPause and standardPause
            const factor = (this.transitionSpeed - speed) / this.transitionSpeed;
            return this.standardPause + (this.maxPause - this.standardPause) * factor;
        }
    }

    setFarnsworth(useFarnsworth) {
        this.useFarnsworth = useFarnsworth;
        this.setSpeed(this.speed); // Recalculate timing
        log.info(`Farnsworth timing ${useFarnsworth ? 'enabled' : 'disabled'}`);
    }

    setFarnsworthSpeed(speed) {
        this.farnsworthSpeed = speed;
        if (this.useFarnsworth) {
            this.setSpeed(this.speed); // Recalculate timing
        }
        if (this.farnsworthSpeedDisplayElement) {
            this.farnsworthSpeedDisplayElement.textContent = speed;
        }
        log.info(`Farnsworth character speed set to ${speed} WPM`);
    }

    setGroupSize(size) {
        this.groupSize = size;
        log.info(`Group size set to ${size}`);
    }
}

module.exports = KochMorseTutor;
