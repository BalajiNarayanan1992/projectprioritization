var speechRecognizer
var avatarSynthesizer
var peerConnection
var peerConnectionDataChannel
var messages = []
var messageInitiated = false
var dataSources = []
var sentenceLevelPunctuations = ['.', '?', '!', ':', ';', '。', '？', '！', '：', '；']
var enableDisplayTextAlignmentWithSpeech = true
var enableQuickReply = false
var quickReplies = ['Let me take a look.', 'Let me check.', 'One moment, please.']
var byodDocRegex = new RegExp(/\[doc(\d+)\]/g)
var isSpeaking = false
var isReconnecting = false
var speakingText = ""
var spokenTextQueue = []
var repeatSpeakingSentenceAfterReconnection = true
var sessionActive = false
var userClosedSession = false
var lastInteractionTime = new Date()
var lastSpeakTime
var imgUrl = ""

// Configuration object - UPDATE THESE VALUES WITH YOUR OWN!
const config = {
    cogSvcRegion: 'westus2',
    cogSvcSubKey: '<YOUR_SPEECH_API_KEY>',
    privateEndpointEnabled: false,
    privateEndpoint: '', // e.g., 'your-custom-name.cognitiveservices.azure.com'
    customVoiceEndpointId: '',
    talkingAvatarCharacter: 'lisa',
    talkingAvatarStyle: 'casual-sitting',
    customizedAvatar: false,
    azureOpenAIEndpoint: '<YOUR_OPENAI_ENDPOINT>',
    azureOpenAIApiKey: '<YOUR_OPENAI_API_KEY>',
    azureOpenAIDeploymentName: '<YOUR_OPENAI_DEPLOYMENT_NAME>',
    enableOyd: false,
    azureCogSearchEndpoint: '',
    azureCogSearchApiKey: '',
    azureCogSearchIndexName: '',
    sttLocales: 'en-US,de-DE,es-ES,fr-FR,it-IT,ja-JP,ko-KR,zh-CN',
    ttsVoice: 'en-US-AvaMultilingualNeural',
    personalVoiceSpeakerProfileID: '',
    continuousConversation: false,
    autoReconnectAvatar: true,
    useLocalVideoForIdle: false,
    showSubtitles: true,
    prompt: 'You are an AI assistant that helps people find information.'
};

// Connect to avatar service
function connectAvatar() {
    if (config.cogSvcSubKey === '') {
        alert('Please fill in the API key of your speech resource.')
        return
    }

    let speechSynthesisConfig
    if (config.privateEndpointEnabled) {
        let endpoint = `wss://${config.privateEndpoint}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true`
        speechSynthesisConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(endpoint), config.cogSvcSubKey)
    } else {
        speechSynthesisConfig = SpeechSDK.SpeechConfig.fromSubscription(config.cogSvcSubKey, config.cogSvcRegion)
    }
    speechSynthesisConfig.endpointId = config.customVoiceEndpointId

    const avatarConfig = new SpeechSDK.AvatarConfig(config.talkingAvatarCharacter, config.talkingAvatarStyle)
    avatarConfig.customized = config.customizedAvatar
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)
    avatarSynthesizer.avatarEventReceived = function (s, e) {
        var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
        if (e.offset === 0) {
            offsetMessage = ""
        }

        console.log("Event received: " + e.description + offsetMessage)
    }

    const speechRecognitionConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${config.cogSvcRegion}.stt.speech.microsoft.com/speech/universal/v2`), config.cogSvcSubKey)
    speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous")
    var sttLocales = config.sttLocales.split(',')
    var autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales)
    speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput())

    if (config.azureOpenAIEndpoint === '' || config.azureOpenAIApiKey === '' || config.azureOpenAIDeploymentName === '') {
        alert('Please fill in the Azure OpenAI endpoint, API key and deployment name.')
        return
    }

    dataSources = []
    if (config.enableOyd) {
        if (config.azureCogSearchEndpoint === "" || config.azureCogSearchApiKey === "" || config.azureCogSearchIndexName === "") {
            alert('Please fill in the Azure Cognitive Search endpoint, API key and index name.')
            return
        } else {
            setDataSources(config.azureCogSearchEndpoint, config.azureCogSearchApiKey, config.azureCogSearchIndexName)
        }
    }

    // Only initialize messages once
    if (!messageInitiated) {
        initMessages()
        messageInitiated = true
    }

    document.getElementById('startSession').disabled = true
    document.getElementById('configuration').hidden = true

    const xhr = new XMLHttpRequest()
    let tokenUrl = config.privateEndpointEnabled ? `https://${config.privateEndpoint}/tts/cognitiveservices/avatar/relay/token/v1` : `https://${config.cogSvcRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`
    xhr.open("GET", tokenUrl)
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", config.cogSvcSubKey)
    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
            const responseData = JSON.parse(this.responseText)
            const iceServerUrl = responseData.Urls[0]
            const iceServerUsername = responseData.Username
            const iceServerCredential = responseData.Password
            setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential)
        }
    })
    xhr.send()
}

// Disconnect from avatar service
function disconnectAvatar() {
    if (avatarSynthesizer !== undefined) {
        avatarSynthesizer.close()
    }

    if (speechRecognizer !== undefined) {
        speechRecognizer.stopContinuousRecognitionAsync()
        speechRecognizer.close()
    }

    sessionActive = false
}

// Setup WebRTC
function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [iceServerUrl],
            username: iceServerUsername,
            credential: iceServerCredential
        }]
    })

    // Fetch WebRTC video stream and mount it to an HTML video element
    peerConnection.ontrack = function (event) {
        if (event.track.kind === 'audio') {
            let audioElement = document.createElement('audio')
            audioElement.id = 'audioPlayer'
            audioElement.srcObject = event.streams[0]
            audioElement.autoplay = true

            audioElement.onplaying = () => {
                console.log(`WebRTC ${event.track.kind} channel connected.`)
            }

            // Clean up existing audio element if there is any
            remoteVideoDiv = document.getElementById('remoteVideo')
            for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                    remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                }
            }

            // Append the new audio element
            document.getElementById('remoteVideo').appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
            let videoElement = document.createElement('video')
            videoElement.id = 'videoPlayer'
            videoElement.srcObject = event.streams[0]
            videoElement.autoplay = true
            videoElement.playsInline = true

            // Continue speaking if there are unfinished sentences
            if (repeatSpeakingSentenceAfterReconnection) {
                if (speakingText !== '') {
                    speakNext(speakingText, 0, true)
                }
            } else {
                if (spokenTextQueue.length > 0) {
                    speakNext(spokenTextQueue.shift())
                }
            }

            videoElement.onplaying = () => {
                // Clean up existing video element if there is any
                remoteVideoDiv = document.getElementById('remoteVideo')
                for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                    if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                        remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                    }
                }

                // Append the new video element
                document.getElementById('remoteVideo').appendChild(videoElement)

                console.log(`WebRTC ${event.track.kind} channel connected.`)
                document.getElementById('microphone').disabled = false
                document.getElementById('stopSession').disabled = false
                document.getElementById('remoteVideo').style.width = '960px'
                document.getElementById('chatHistory').hidden = false
                document.getElementById('showTypeMessage').disabled = false

                if (config.useLocalVideoForIdle) {
                    document.getElementById('localVideo').hidden = true
                    if (lastSpeakTime === undefined) {
                        lastSpeakTime = new Date()
                    }
                }

                isReconnecting = false
                setTimeout(() => { sessionActive = true }, 5000) // Set session active after 5 seconds
            }
        }
    }

    // Listen to data channel, to get the event from the server
    peerConnection.addEventListener("datachannel", event => {
        peerConnectionDataChannel = event.channel
        peerConnectionDataChannel.onmessage = e => {
            let subtitles = document.getElementById('subtitles')
            const webRTCEvent = JSON.parse(e.data)
            if (webRTCEvent.event.eventType === 'EVENT_TYPE_TURN_START' && config.showSubtitles) {
                subtitles.hidden = false
                subtitles.innerHTML = speakingText
            } else if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END' || webRTCEvent.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
                subtitles.hidden = true
                if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END') {
                    if (config.autoReconnectAvatar && !userClosedSession && !isReconnecting) {
                        // No longer reconnect when there is no interaction for a while
                        if (new Date() - lastInteractionTime < 300000) {
                            // Session disconnected unexpectedly, need reconnect
                            console.log(`[${(new Date()).toISOString()}] The WebSockets got disconnected, need reconnect.`)
                            isReconnecting = true

                            // Remove data channel onmessage callback to avoid duplicatedly triggering reconnect
                            peerConnectionDataChannel.onmessage = null

                            // Release the existing avatar connection
                            if (avatarSynthesizer !== undefined) {
                                avatarSynthesizer.close()
                            }

                            // Setup a new avatar connection
                            connectAvatar()
                        }
                    }
                }
            }

            console.log("[" + (new Date()).toISOString() + "] WebRTC event received: " + e.data)
        }
    })

    // This is a workaround to make sure the data channel listening is working by creating a data channel from the client side
    c = peerConnection.createDataChannel("eventChannel")

    // Make necessary update to the web page when the connection state changes
    peerConnection.oniceconnectionstatechange = e => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === 'disconnected') {
            if (config.useLocalVideoForIdle) {
                document.getElementById('localVideo').hidden = false
                document.getElementById('remoteVideo').style.width = '0.1px'
            }
        }
    }

    // Offer to receive 1 audio, and 1 video track
    peerConnection.addTransceiver('video', { direction: 'sendrecv' })
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

    // start avatar, establish WebRTC connection
    avatarSynthesizer.startAvatarAsync(peerConnection).then((r) => {
        if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("[" + (new Date()).toISOString() + "] Avatar started. Result ID: " + r.resultId)
        } else {
            console.log("[" + (new Date()).toISOString() + "] Unable to start avatar. Result ID: " + r.resultId)
            if (r.reason === SpeechSDK.ResultReason.Canceled) {
                let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(r)
                if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                    console.log(cancellationDetails.errorDetails)
                };

                console.log("Unable to start avatar: " + cancellationDetails.errorDetails);
            }
            document.getElementById('startSession').disabled = false;
            document.getElementById('configuration').hidden = true;
        }
    }).catch(
        (error) => {
            console.log("[" + (new Date()).toISOString() + "] Avatar failed to start. Error: " + error)
            document.getElementById('startSession').disabled = false
            document.getElementById('configuration').hidden = true
        }
    )
}

// Initialize messages
function initMessages() {
    messages = []

    if (dataSources.length === 0) {
        let systemPrompt = config.prompt
        let systemMessage = {
            role: 'system',
            content: systemPrompt
        }

        messages.push(systemMessage)
    }
}

// Set data sources for chat API
function setDataSources(azureCogSearchEndpoint, azureCogSearchApiKey, azureCogSearchIndexName) {
    let dataSource = {
        type: 'AzureCognitiveSearch',
        parameters: {
            endpoint: azureCogSearchEndpoint,
            key: azureCogSearchApiKey,
            indexName: azureCogSearchIndexName,
            semanticConfiguration: '',
            queryType: 'simple',
            fieldsMapping: {
                contentFieldsSeparator: '\n',
                contentFields: ['content'],
                filepathField: null,
                titleField: 'title',
                urlField: null
            },
            inScope: true,
            roleInformation: config.prompt
        }
    }

    dataSources.push(dataSource)
}

// Do HTML encoding on given text
function htmlEncode(text) {
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };

    return String(text).replace(/[&<>"'\/]/g, (match) => entityMap[match])
}

// Speak the given text
function speak(text, endingSilenceMs = 0) {
    if (isSpeaking) {
        spokenTextQueue.push(text)
        return
    }

    speakNext(text, endingSilenceMs)
}

function speakNext(text, endingSilenceMs = 0, skipUpdatingChatHistory = false) {
    let ttsVoice = config.ttsVoice
    let personalVoiceSpeakerProfileID = config.personalVoiceSpeakerProfileID
    let ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:ttsembedding speakerProfileId='${personalVoiceSpeakerProfileID}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(text)}</mstts:ttsembedding></voice></speak>`
    if (endingSilenceMs > 0) {
        ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:silence type='append' msec='${endingSilenceMs}'/></voice></speak>`
    }

    speakingText = text
    isSpeaking = true
    lastSpeakTime = new Date()
    avatarSynthesizer.speakSsmlAsync(ssml).then(result => {
        if (!skipUpdatingChatHistory) {
            updateChatHistory(text, false)
        }
        speakingText = ""
        isSpeaking = false
        if (spokenTextQueue.length > 0) {
            speakNext(spokenTextQueue.shift())
        }
    }, error => {
        console.log("Error during TTS: " + error)
        speakingText = ""
        isSpeaking = false
        if (spokenTextQueue.length > 0) {
            speakNext(spokenTextQueue.shift())
        }
    })
}

// Update chat history
function updateChatHistory(text, isUser) {
    let chatHistory = document.getElementById('chatHistory')
    let messageDiv = document.createElement('div')
    messageDiv.className = isUser ? 'user-message' : 'avatar-message'
    messageDiv.textContent = text
    chatHistory.appendChild(messageDiv)
    chatHistory.scrollTop = chatHistory.scrollHeight
}

// Handle user query
function handleUserQuery(userQuery, userQueryHTML, imgUrl) {
    if (!sessionActive) {
        alert('Please start a session first.')
        return
    }

    if (userQuery === '') return

    lastInteractionTime = new Date()
    updateChatHistory(userQuery, true)
    let chatInput = {
        role: 'user',
        content: userQuery
    }

    messages.push(chatInput)
    let request = {
        messages: messages,
        stream: false,
        dataSources: dataSources
    }

    fetch(config.azureOpenAIEndpoint + '/openai/deployments/' + config.azureOpenAIDeploymentName + '/chat/completions?api-version=2023-05-15', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.azureOpenAIApiKey
        },
        body: JSON.stringify(request)
    }).then(response => response.json())
        .then(data => {
            if (data.error) {
                const errorMessage = "Error from OpenAI: " + data.error.message;
                console.error(errorMessage);
                alert(errorMessage);  // Show the error to the user
                return;
            }
            const reply = data.choices[0].message.content
            let replyWithoutDocs = reply.replace(byodDocRegex, '')
            let finalReply = replyWithoutDocs
            if (imgUrl != "") {
                finalReply = "<br/><img src=\"" + imgUrl + "\" style=\"width:100px;height:100px\"/><br/>" + replyWithoutDocs
            }
            messages.push({ role: 'assistant', content: reply })
            speak(finalReply)
        })
        .catch(error => {
            console.error('Error:', error)
            alert('Error: ' + error); // Show the error to the user.
        })
}

// Add event listener to start session button
window.addEventListener('load', () => {
    document.getElementById('startSession').addEventListener('click', connectAvatar)
    document.getElementById('stopSession').addEventListener('click', disconnectAvatar)
    connectAvatar(); // Auto-connect
});
```

**`chat.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Talking Avatar Chat Demo</title>
    <link href="./css/styles.css" rel="stylesheet">
    <script src="https://aka.ms/csspeech/jsbrowserpackageraw"></script>
    <script src="./js/chat.js"></script>
</head>
<body>
<h1>Talking Avatar Chat Demo</h1>

<div id="configuration" hidden>
</div>

<button id="startSession">Start Avatar Session</button>
<button id="stopSession" onclick="window.stopSession()" disabled>Close Avatar Session</button>

<div id="videoContainer" style="position: relative; width: 960px;">
  <div id="overlayArea" style="position: absolute;">
    <div id="chatHistory" style="
        width: 360px;
        height: 480px;
        font-size: medium;
        border: none;
        resize: none;
        background-color: transparent;
        overflow: hidden;" contentEditable="true" hidden></div>
    </div>
    <div id="localVideo" hidden>
      <video src="video/lisa-casual-sitting-idle.mp4" autoplay loop muted></video>
    </div>
    <div id="remoteVideo"></div>
    <div id="subtitles" style="
        width: 100%;
        text-align: center;
        color: white; 
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        font-size: 22px; 
        position: absolute; 
        bottom: 5%; 
        z-index: 999;" hidden></div>
  </div>
  <div margin-top="5px">
    <div id="showTypeMessageCheckbox">
      <input type="checkbox" id="showTypeMessage" onchange="window.updateTypeMessageBox()" disabled>Type Message</input><br />
    </div>
    <div id="userMessageBox" hidden>
        <textarea id="userText" placeholder="Type your message here..." rows="4" cols="50"></textarea>
        <button id="sendBtn" onclick="window.sendTextMessage()">Send</button>
        <button id="uploadImgIcon" >+</button>
    </div>
  </div>
</div>

<script>
    //window.addEventListener('load', connectAvatar); // Start connection on load
</script>
</body>
</html>
