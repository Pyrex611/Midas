/**************************************************************************
 * IMPORTS
 ***************************************************************************/
import Fragment from "./fragment.js";
/**
 * Email
 */
declare class Email {
    private fragments;
    /**
     * Constructor
     */
    constructor(fragments?: Fragment[]);
    /**
     * Get all fragments for an email
     */
    getFragments(): Fragment[];
    /**
     * Get the visible text for an email
     */
    getVisibleText(): string;
    /**
     * Get the quoted text for an email
     */
    getQuotedText(): string;
    /**
     * Apply a filter method to the fragments
     */
    private filterText;
}
export default Email;
