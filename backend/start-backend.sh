#!/bin/bash
# backend/start-backend.sh
npm run migrate:deploy && node dist/index.js