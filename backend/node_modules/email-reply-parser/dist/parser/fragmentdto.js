/*
 * email-reply-parser
 *
 * Copyright 2025, Mirage AI
 * Author: Baptiste Jamin <baptiste@jam.in>
 */
/**
 * FragmentDTO
 */
class FragmentDTO {
    /**
     * Constructor
     */
    constructor() {
        this.lines = [];
        this.isHidden = false;
        this.isSignature = false;
        this.isQuoted = false;
    }
}
export default FragmentDTO;
