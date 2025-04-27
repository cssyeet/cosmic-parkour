// Utility functions
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
} 