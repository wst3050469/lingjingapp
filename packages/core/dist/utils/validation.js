export const validateUsername = (username) => {
    return /^[\u4e00-\u9fa5a-zA-Z0-9_]{3,50}$/.test(username);
};
export const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 100;
};
export const validatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8)
        strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password))
        strength++;
    if (/\d/.test(password))
        strength++;
    if (/[^a-zA-Z0-9]/.test(password))
        strength++;
    if (strength <= 2)
        return 'weak';
    if (strength === 3)
        return 'medium';
    return 'strong';
};
export const validateKeyName = (name) => {
    return /^[\u4e00-\u9fa5a-zA-Z0-9_]{3,50}$/.test(name);
};
export const validateDeviceName = (name) => {
    return name.length >= 1 && name.length <= 100;
};
export const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
export const validatePort = (port) => {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
};
export const validatePath = (path) => {
    return path.length > 0 && !/[<>:"|?*]/.test(path);
};
export const validateApiKeyFormat = (key) => {
    return /^lj_[a-zA-Z0-9]{32,64}$/.test(key);
};
export const maskApiKey = (key) => {
    if (key.length < 12)
        return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
};
//# sourceMappingURL=validation.js.map