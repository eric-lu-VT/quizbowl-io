/**
 * Script for frontend
 * @author @eric-lu-VT (Eric Lu)
 */

let socket = io();
let clientId = null;
let curQuestionType = null;

var synth = window.speechSynthesis;

// W3C text-to-speech components
var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList;
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent;

// HTML divs in frontend, forming separate pages
const introScreen = document.getElementById("introScreen");
const functionScreen = document.getElementById("functionScreen");
const settingsScreen = document.getElementById("settingsScreen");
const resultScreen = document.getElementById("resultScreen");

// Button components in frontend
const btnExternal = document.getElementById("btnExternal");
const btnDownload = document.getElementById("btnDownload");
const btnReset = document.getElementById("btnReset");
const btnTossup = document.getElementById("btnTossup");
const btnBonus = document.getElementById("btnBonus");
const btnBuzz = document.getElementById("btnBuzz");

// Input results from frontend
const txtPacketURL = document.getElementById("txtPacketURL");
const inputNextQuestion = document.getElementById("inputNextQuestion");
const txtScore = document.getElementById("txtScore");
const txtAnswerResult = document.getElementById("answerResult");
const txtAnswerCorrect = document.getElementById("answerCorrect"); 
const txtAnswerRecieved = document.getElementById("answerRecieved"); 
const txtAnswerSimilarity = document.getElementById("answerSimilarity");
var rate = document.querySelector("#rate");
var rateValue = document.querySelector(".rate-value");

const PERCENTAGE_THRESHOLD = 0.83; // How 'similar' two words must be to be considered the same

/**
 * Processes to run when frontend first connects to backend.
 * @listens "connect"
 */
socket.on("connect", () => {
    clientId = socket.id;
    clientName = clientId;

    // console.log(clientId);
});

/**
 * Processes to run when "btnExternal" is pressed.
 * @listens "click"
 */
btnExternal.addEventListener("click", e => {
    window.open("https://quizbowlpackets.com/");
});

/**
 * Processes to run when "btnDownload" is pressed.
 * @listens "click"
 */
btnDownload.addEventListener("click", e => {

    // console.log(txtPacketURL.value)
    if(txtPacketURL.value === "") {
        document.getElementById("txtDownloadError").innerHTML = "Failed to download" +
        " the packet. You did not enter a valid URL in."
    }
    else {
        document.getElementById("txtDownloadError").innerHTML = "";
        const payLoad = {
            "clientId": clientId,
            "packetURL": txtPacketURL.value
        }

        socket.emit("download", payLoad); // send to backend
    }
});

/**
 * Processes to run when "btnReset" is pressed.
 * @listens "click"
 */
btnReset.addEventListener("click", e => {
    socket.emit("reset", clientId); // send to backend
});

/**
 * Processes to run when "btnTossup" is pressed.
 * @listens "click"
 */
btnTossup.addEventListener("click", e => {
    const payLoad = {
        "clientId": clientId,
        "typeQuestion": "tossup"
    }

    socket.emit("beginQuestion", payLoad); // send to backend
});

/**
 * Processes to run when "btnBonus" is pressed.
 * @listens "click"
 */
btnBonus.addEventListener("click", e => {
    const payLoad = {
        "clientId": clientId,
        "typeQuestion": "bonus"
    }

    socket.emit("beginQuestion", payLoad); // send to backend
});

/**
 * Processes to run when "btnBuzz" is pressed.
 * @listens "click"
 */
btnBuzz.addEventListener("click", e => {
    const payLoad = {
        "clientId": clientId,
        "typeQuestion": curQuestionType
    }
    socket.emit("buzz", payLoad); // send to backend
});

/**
 * Processes to run when "download" is recieved from backend.
 * @listens "download"
 */
socket.on("download", (response) => {
    if(response.success) {
        introScreen.style.display = "none";
        functionScreen.style.display = "block";
        txtPacketURL.value = "";
        if(response.containsTossups) {
            btnTossup.disabled = false;
            document.getElementById("txtNoMoreTossup").style.display = "none";
        }
        else {
            document.getElementById("txtNoMoreTossup").style.display = "block";
            btnTossup.disabled = true;
        }
        if(response.containsBonuses) {
            document.getElementById("txtNoMoreBonus").style.display = "none";
            btnBonus.disabled = false;
        }
        else {
            document.getElementById("txtNoMoreBonus").style.display = "block";
            btnBonus.disabled = true;
        }
        
        updateScore(0, clientId);
    }
});

/**
 * Processes to run when "reset" is recieved from backend.
 * @listens "reset"
 */
socket.on("reset", () => {
    introScreen.style.display = "block";
    functionScreen.style.display = "none";
    resultScreen.style.display = "none";
});

/**
 * Procesess to run when "beginQuestion" is recieved from backend.
 * @listens "beginQuestion"
 */
socket.on("beginQuestion", (response) => {
    settingsScreen.style.display = "none";
    resultScreen.style.display = "none";
    btnReset.style.display = "none";
    btnTossup.style.display = "none";
    btnBonus.style.display = "none";
    btnBuzz.style.display = "block";
    curQuestionType = response.typeQuestion;
    speak(response.question);
});

/**
 * Processes to run when "buzz" is recieved from backend.
 * @listens "buzz"
 */
socket.on("buzz", (response) => {
    const isNeg = synth.speaking;
    synth.pause();
    synth.cancel();
    if(response.isTossupsEmpty) {
        document.getElementById("txtNoMoreTossup").style.display = "block";
        btnTossup.disabled = true;
    }
    if(response.isBonusesEmpty) {
        document.getElementById("txtNoMoreBonus").style.display = "block";
        btnBonus.disabled = true;
    }
    testSpeech(response.answer, isNeg);
});

/**
 * Processes to run when "updateScore" is recieved from backend.
 * @listens "updateScore"
 */
socket.on("updateScore", (response) => {
    txtScore.textContent = "Your Score: " + response.newScore;
});

/**
 * Change rate variable when rate of speech slider is changed.
 */
rate.onchange = function() {
    rateValue.textContent = rate.value;
}

/**
 * Text-to-speech function.
 * @param {*} text the text to speak
 */
function speak(text) {
    if(synth.speaking) {
        console.error("speechSynthesis.speaking");
        return;
    }
    var utterThis = new SpeechSynthesisUtterance(text);
    utterThis.onend = function (event) {
        // console.log("SpeechSynthesisUtterance.onend");
    }
    utterThis.onerror = function (event) {
        console.error("SpeechSynthesisUtterance.onerror");
    }
    utterThis.rate = rate.value;
    // utterThis.voice = "Microsoft Mark - English (United States)";
    synth.speak(utterThis);
}

/**
 * Tests if answer recieved is right, and displays results
 * @param {*} text answer recieved 
 * @param {Boolean} isNeg if the question has the potential of being a neg
 */
function testSpeech(text, isNeg) {
    text = text.toLowerCase();

    var grammar = "#JSGF V1.0; grammar phrase; public <phrase> = " + text +";";
    var recognition = new SpeechRecognition();
    var speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();
             
    recognition.onresult = function(event) {
        var speechResult = event.results[0][0].transcript.toLowerCase();
        // console.log("Confidence: " + event.results[0][0].confidence);
                
        txtAnswerRecieved.textContent = "Speech received: " + speechResult;
        const percentSimilar = similarity(text.toLowerCase(), speechResult.toLowerCase());
        txtAnswerSimilarity.textContent = "Similarity ratio: " + percentSimilar;
        
        if(percentSimilar > PERCENTAGE_THRESHOLD) {
            txtAnswerResult.textContent = "Correct answer! SCORE +10";
            txtAnswerResult.style.background = "lime";
            updateScore(10, clientId);
        }
        else {
            txtAnswerResult.style.background = "red";
            if(isNeg) {
                txtAnswerResult.textContent = "Incorrect answer. SCORE -5 (NEG)";
                updateScore(-5, clientId);
            }
            else {
                txtAnswerResult.textContent = "Incorrect answer.";
            }
        }
        txtAnswerCorrect.textContent = "The correct answer was: " + text;

        settingsScreen.style.display = "block";
        resultScreen.style.display = "block";
        btnReset.style.display = "block";
        btnTossup.style.display = "block";
        btnBonus.style.display = "block";
        btnBuzz.style.display = "none";
    }

    recognition.onspeechend = function() {
        recognition.stop();
    }
    
    recognition.onerror = function(event) {
        txtAnswerRecieved.textContent = "Error occurred in recognition: " + event.error;
    }
}

/**
 * Updates the user's score.
 * @param {Number} amnt amount to update score by
 * @param {String} clientId socket id of frontend
 */
function updateScore(amnt, clientId) {
    const payLoad = {
        "clientId": clientId,
        "amnt": amnt
    }
    socket.emit("updateScore", payLoad);
}

/**
* Determines the percent equivalency of two inputted strings. 
* This function uses the concept of Levenshtein distance to do so (@see editDistance)
* @param {String} s1 - The first string in question.
* @param {String} s2 - The second string in question.
* @returns {number} The percent equivalency of the two inputted strings.
*/
function similarity(s1, s2) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

/**
* Determines the Levenshtein distance between two inputted strings. 
* @param {String} s1 - The first string in question.
* @param {String} s2 - The second string in question.
* @returns {number} The Levenshtein distance between the two inputted strings.
*/
function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
  
    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}