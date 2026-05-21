export interface OpenSpaceDetectionResult {
    found: boolean;
    path: string | null;
    method: string;
    version?: string;
}
export declare function detectOpenSpaceWindows(): OpenSpaceDetectionResult;
export declare function detectOpenSpaceLinux(): OpenSpaceDetectionResult;
export declare function detectOpenSpace(): OpenSpaceDetectionResult;
export interface OpenSpacePatchResult {
    detection: OpenSpaceDetectionResult;
    wsBridgeReady: boolean;
    windowEmbedReady: boolean;
}
export declare function patchOpenSpaceIntegration(): OpenSpacePatchResult;
export declare const LUA_FRAME_EXPORT: string;
export declare const LUA_GLOBE_SYNC: string;
