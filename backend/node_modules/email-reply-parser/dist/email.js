/*
 * email-reply-parser
 *
 * Copyright 2025, Mirage AI
 * Author: Baptiste Jamin <baptiste@jam.in>
 */
// REGEXES
const TILDE_REGEX = /~*$/;
/**
 * Email
 */
class Email {
    /**
     * Constructor
     */
    constructor(fragments = []) {
        this.fragments = fragments;
    }
    /**
     * Get all fragments for an email
     */
    getFragments() {
        return this.fragments;
    }
    /**
     * Get the visible text for an email
     */
    getVisibleText() {
        return this.filterText((fragment) => {
            return !fragment.isHidden();
        });
    }
    /**
     * Get the quoted text for an email
     */
    getQuotedText() {
        return this.filterText((fragment) => {
            return fragment.isQuoted();
        });
    }
    /**
     * Apply a filter method to the fragments
     */
    // eslint-disable-next-line no-unused-vars
    filterText(filter) {
        let filteredFragments = this.fragments.filter(filter);
        return filteredFragments.join("\n").replace(TILDE_REGEX, "");
    }
}
export default Email;
