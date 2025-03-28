'use strict';


const { EchoTrainerUI } = require('./m32-echo-trainer-ui');
const { M32ConnectUI } = require('./m32-connect-ui');
const { M32CwGeneratorUI } = require('./m32-cw-generator-ui');
const { QsoTrainerUI } = require('./m32-qso-trainer');
const { M32CommunicationService } = require('./m32-communication-service');
const { M32Storage } = require('./m32-storage');
const { FileUploadUI } = require('./m32-file-upload-ui');
const { CWMemoryUI } = require('./m32-cw-memory-ui');
const KochMorseTutor = require('./koch-morse-tutor');
let log = require("loglevel");
var events = require('events');
const { ConfigurationUI } = require('./m32-configuration-ui');

class M32Main {
    constructor() {
        log.debug("initM32");

        //this.mode = MODE_CW_GENERATOR;

        let m32Storage = new M32Storage();

        let m32CommunicationService = new M32CommunicationService();

        this.m32ConnectUI = new M32ConnectUI(m32CommunicationService, m32Storage);
        this.m32CwGeneratorUI = new M32CwGeneratorUI(m32CommunicationService, m32Storage);
        this.echoTrainerUI = new EchoTrainerUI(m32CommunicationService);
        this.qsoTrainerUI = new QsoTrainerUI(m32CommunicationService, m32Storage);
        this.configurationUI = new ConfigurationUI(m32CommunicationService, document.getElementById('m32-config'));
        this.fileUploadUI = new FileUploadUI(m32CommunicationService);
        this.cwMemoryUI = new CWMemoryUI(m32CommunicationService);

        // Initialize Koch Tutor
        this.kochMorseTutor = new KochMorseTutor({
            speedControlElement: document.getElementById('kochSpeedControl'),
            farnsworthToggleElement: document.getElementById('farnsworthToggle'),
            farnsworthSpeedElement: document.getElementById('farnsworthSpeed'),
            displayElement: document.getElementById('kochDisplay'),
            currentCharElement: document.getElementById('currentChar'),
            groupResultElement: document.getElementById('groupResult'),
            speedDisplayElement: document.getElementById('kochSpeedDisplay')
        });

        m32Storage.loadSettings();

        //document.getElementById("versionSpan").textContent = VERSION;

        this.eventEmitter = new events.EventEmitter();
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.echoTrainerUI.modeSelected.bind(this.echoTrainerUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.m32CwGeneratorUI.modeSelected.bind(this.m32CwGeneratorUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.qsoTrainerUI.modeSelected.bind(this.qsoTrainerUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.kochMorseTutor.modeSelected.bind(this.kochMorseTutor));

        // enable bootstrap tooltips everywhere:    
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            // eslint-disable-next-line no-undef
            return new bootstrap.Tooltip(tooltipTriggerEl, { trigger : 'hover' });
        });    

        /*for (let tabElement of document.querySelectorAll('button[data-bs-toggle="tab"]')) {
            tabElement.addEventListener('shown.bs.tab', this.tabEventListener.bind(this));
        }*/

        let urlParams = new URLSearchParams(window.location.search);
        let paramMode = urlParams.get('mode');
        if (paramMode) {
            console.log('setting mode from url params:', paramMode);
            this.openTabForMode(paramMode);
        }

        /*if (urlParams.get('debug') !== null) {
            this.m32CwGeneratorUI.setDebug(true);
            this.echoTrainerUI.setDebug(true);
            log.info('debug mode enabled!');
        } else {
            this.m32CwGeneratorUI.setDebug(false);
            this.echoTrainerUI.setDebug(true);
            console.log('debug mode disabled!');
        }*/
        let paramM32Language = urlParams.get('language');
        if (paramM32Language) {
            console.log('setting m32language to ', paramM32Language);
            m32CommunicationService.setLanguage(paramM32Language);
        }

        //console.log(document.getElementById('kochSpeedControl'));

        /*document.getElementById('kochSpeedControl').addEventListener('input', () => {
            //let speedDis = document.getElementById('kochSpeedDisplay');
            let speed = parseInt(document.getElementById('kochSpeedControl').value, 10);
            //speedDis.innerText = speed.value;
            //console.log(speedDis.innerText);
            this.kochMorseTutor.setMorseSpeed(speed);
            //this.kochMorseTutor.startLesson();
        });*/

        // Add event listener for Koch Trainer start button
        document.getElementById('startKochTraining').addEventListener('click', () => {
            const speed = parseInt(document.getElementById('kochSpeedControl').value, 10);
            this.kochMorseTutor.setSpeed(speed);
            this.kochMorseTutor.startLesson();
        });

        // Add event listener for Farnsworth toggle
        /*document.getElementById('farnsworthToggle').addEventListener('change', (event) => {
            this.kochTutor.setFarnsworth(event.target.checked);
        });

        // Add event listener for Farnsworth speed
        document.getElementById('farnsworthSpeed').addEventListener('input', (event) => {
            this.kochTutor.setFarnsworthSpeed(parseInt(event.target.value, 10));
        });*/
    }

    /*tabEventListener(event) {
        let mode = event.target.id.replace('-tab', '');
        this.eventEmitter.emit(EVENT_MODE_SELECTED, mode);
    }*/

    openTabForMode(mode) {
        if (mode === MODE_CW_GENERATOR) {
            document.getElementById('cw-generator-tab').click();
        } else if (mode === MODE_ECHO_TRAINER) {
            document.getElementById('echo-trainer-tab').click();
        } else if (mode === MODE_QSO_TRAINER) {
            document.getElementById('qso-trainer-tab').click();
        } else if (mode === MODE_M32_CONFIG) {
            document.getElementById('m32-config-tab').click();
        } else if (mode === MODE_FILE_UPLOAD) {
            document.getElementById('m32-file-upload-tab').click();
        } else if (mode === MODE_CW_MEMORY) {
            document.getElementById('m32-cw-memory-tab').click();
        } else if (mode === MODE_KOCH_TRAINER) {
            document.getElementById('koch-tab').click();
        } else {
            console.log('Unknown mode: ', mode);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new M32Main();
}, false);
