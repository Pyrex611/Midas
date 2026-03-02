/**
 * Fragment
 */
declare class Fragment {
    private _content;
    private _isHidden;
    private _isSignature;
    private _isQuoted;
    /**
     * Constructor
     */
    constructor(content: string, isHidden: boolean, isSignature: boolean, isQuoted: boolean);
    /**
     * Check if the fragment is hidden
     */
    isHidden(): boolean;
    /**
     * Check if the fragment is a signature
     */
    isSignature(): boolean;
    /**
     * Check if the fragment is quoted
     */
    isQuoted(): boolean;
    /**
     * Get the content of the fragment
     */
    getContent(): string;
    /**
     * Check if the fragment is empty
     */
    isEmpty(): boolean;
    /**
     * Get the string representation of the fragment
     */
    toString(): string;
}
export default Fragment;
