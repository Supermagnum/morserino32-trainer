# Morserino32 CW Trainer

A browser reads the cw trainer characters from the morserino device via serial input and compares them to the characters entered by the user.

Just go to the [Live Demo Page](https://tegmento.org)!

You might need to configure the morserino to send characters via serial line first! (see below how to do so)

* Connect usb cable from Morserino32 to your PC/Mac/Linux machine
* Open index.html in browser
* In the web page use "Connect" button, select serial port of Morserino32
* Start CW-Generator
* Type your decoded CW into the second field.
* Hide received/compared text if you want.

The results can also be saved into the local storage of the browser to show the progress you make and to have some text to encode in cw.

Supported browsers:
* Chrome
* Edge
* Opera

For details of browser support see [here](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/serial).

## Configure morserino32 to send Decoder to serial output

By default, the morserino does not send data to the serial connection.

* Double click black button
* Find "Serial Output"
* Set to "Everything" - you might to do this for every stored snapshot profile you want to use!

## Build

```bash
# compile script to bundle.js
browserify js/m32main.js   -o js/bundle.js

# or during development use watchify to compile on changes:
watchify js/m32main.js   -o js/bundle.js
```

## Feature Requests

### Serial Protocol with morserino

* Allow full remote control from the web application
* Speech output for visually impaired users.
* see [serialtest.html](serialtest.html) for details or better test at [serialtest at tegmento](//tegmento.org/serialtest.html)

### Play Texts

* Play full QSO examples
  * with random callsigns/QTH/etc.
* Play other texts
  * german
  * english
  * upload your own texts
    * store them in local session so they are remembered
* Modes
  * User needs to type word correctly or repeat
  * just play

### Feedback from blind user Marcus

* menu "info
  * nice: get device - voice ouput firmware and battery
* important:
  * configuration
  * if "quick start" on -> to remember current state after switch on
    * forget to speak
* adaptive random speed
  * concurrent voice output and the morse character
* if morserino is in scroll mode, it should also speak the characters (m32 feature)
* create snapshots for cw school - DONE
* random texts
  * "(z)" - random words of text
  * speak one sentence after the other

* voice output for "upload done" - does not work because upload is async

### QSO Bot

* remove callsign with space (/)
* <bk> as end (/)
* real callsigns (/)
* wx (/)
  * wx: raining: min -2c (/)
  * wx (is) sunny
* good bye: QRU/QRT -> answer also with QRU
  * tu e e 
    * e e
  * if gb -> then no "kn", but "sk e e"
    * and do nto send "xx de yy", but only "e e"!
* gm <call> from <qth>
* you have to send correct xxx de yyy first!
* add rig description
* if I do not understand, send
  * ur name ?
* "I am lazy"
  * let bot start QSO
  * let bot continue QSO

### Morserino Protocol

* Create/save snapshots of CW school Graz
* Select Wifi  (/)
* CW Generator
  * Voice output for results. How? e.g. Bravo missing, X-Ray wrong, ...

 ### Modifications coming:

* Modified Koch training method, that not only trains receiving but also using a morse key at the same time!
Mode example: First the program sends a series of K's in CW for 30 seconds while the character K is displayed. 
Then it repeats the procedure with the character M. When that is complete it sends a five characters group using K and M in random places without displaying the signs. It then waits for a five characters input using the keyboard or the morse device, shows the characters you have gotten correct in green, the wrong ones in red.
* Flexible, speed-dependent pause between characters during Morse code practice. This allows beginners to start with longer pauses between characters (easier to process) and gradually reduce these pauses as they increase their speed, smoothly transitioning to standard Morse timing at higher speeds.

* That continues until the user has gotten 90 % correct of a number of groups, then a new letter is automatically  introduced ( for example X ), it is sent for 30 seconds while the character is displayed.
* Then the lesson continues using the new character until 90% of groups is correct, a new character or prosign is introduced and the lessons continues until all characters are learned!

* When that function works I might implement:
* Create a database so it can store the username,user location and maidenhead location, statistics on characters learned, time used.
* Post user progress and statistics to https://lcwo.net/ if possible.
* Show what characters the user is struggling with, these can be selected for practice.
* Enable the qso trainer when all characters have been learned.
* Modify the qso trainer to use the users callsign,home location and maidenhead as "home".
* The possibility to connect the application to Discord,Mumble or other low latency voice chat programs.
This looks like a good alternative:
https://sites.google.com/site/icwoip
* Realistic mode for the qso trainer and Discord,Mumble etc that adds white noise,static and QRM. This is not needed for 
https://www.hamsphere.com/
as it will simulate radio propagation.

* Support for pipewire:
https://www.pipewire.org/
Opera Web browser is compatible with pipewire.

* Programming suggestions for implementation of the functions:
https://github.com/Supermagnum/morserino32-trainer/tree/main/todo

Written with help of TABNINES AI,- because I have a neurological condition that makes it impossible for me to understand programming.
 

