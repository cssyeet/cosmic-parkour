const fs = require('fs');
const path = require('path');

// Create sounds directory if it doesn't exist
const soundsDir = path.join(__dirname, 'sounds');
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir);
}

// Function to generate a sound and save it as an MP3
function generateSound(name, options) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = options.type || 'sine';
    oscillator.frequency.value = options.frequency || 440;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(options.volume || 0.5, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + options.duration || 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + (options.duration || 0.5));
    
    // Save the audio buffer as an MP3
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * (options.duration || 0.5), audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Generate the sound
    for (let i = 0; i < channelData.length; i++) {
        const t = i / audioContext.sampleRate;
        channelData[i] = Math.sin(2 * Math.PI * options.frequency * t) * Math.exp(-t * 5);
    }
    
    // Save as WAV (since we can't directly save as MP3 in Node.js)
    const wavPath = path.join(soundsDir, `${name}.wav`);
    const wavBuffer = bufferToWav(buffer);
    fs.writeFileSync(wavPath, wavBuffer);
    
    console.log(`Generated ${name}.wav`);
}

// Generate our sound effects
generateSound('jump', {
    type: 'sine',
    frequency: 800,
    duration: 0.3,
    volume: 0.6
});

generateSound('wall_run', {
    type: 'square',
    frequency: 600,
    duration: 0.4,
    volume: 0.4
});

generateSound('land', {
    type: 'sine',
    frequency: 400,
    duration: 0.2,
    volume: 0.5
});

generateSound('death', {
    type: 'sawtooth',
    frequency: 200,
    duration: 1.0,
    volume: 0.8
});

generateSound('footstep', {
    type: 'sine',
    frequency: 300,
    duration: 0.1,
    volume: 0.3
});

// Helper function to convert AudioBuffer to WAV
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, totalSize - 8, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * blockAlign, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);
    
    // Write the PCM samples
    const offset = 44;
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + i * 2, value, true);
    }
    
    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
} 