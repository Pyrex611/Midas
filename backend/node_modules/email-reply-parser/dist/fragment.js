/*
 * email-reply-parser
 *
 * Copyright 2025, Mirage AI
 * Author: Baptiste Jamin <baptiste@jam.in>
 */
const EMPTY_REGEX = /\n/g;
/**
 * Fragment
 */
class Fragment {
    /**
     * Constructor
     */
    constructor(content, isHidden, isSignature, isQuoted) {
        this._content = content;
        this._isHidden = isHidden;
        this._isSignature = isSignature;
        this._isQuoted = isQuoted;
    }
    /**
     * Check if the fragment is hidden
     */
    isHidden() {
        return this._isHidden;
    }
    /**
     * Check if the fragment is a signature
     */
    isSignature() {
        return this._isSignature;
    }
    /**
     * Check if the fragment is quoted
     */
    isQuoted() {
        return this._isQuoted;
    }
    /**
     * Get the content of the fragment
     */
    getContent() {
        return this._content;
    }
    /**
     * Check if the fragment is empty
     */
    isEmpty() {
        return "" === this.getContent().replace(EMPTY_REGEX, "");
    }
    /**
     * Get the string representation of the fragment
     */
    toString() {
        return this.getContent();
    }
}
export default Fragment;
