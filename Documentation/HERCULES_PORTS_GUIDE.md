# Hercules TK5 Port Configuration — Verified & Tested

## Executive Summary

**CRITICAL**: The `.env.example` file contains **INCORRECT port numbers**. After deep testing and verification, here are the **actual working ports** for Hercules TK5:

| Service | Incorrect (.env.example) | Correct (Verified) | Purpose |
|---------|--------------------------|-------------------|---------|
| HTTP Console | 8081 | **8038** | Web interface & command API |
| Card Reader | 3505 | **3505** | JCL job submission |
| TN3270 Terminal | 3270 | **3270** | 3270 terminal sessions |

---

## Verified Port Configuration

### 1. **Port 3505 — Card Reader (JCL Submission)** ✓ CORRECT

**Purpose**: Submit JCL jobs to MVS via TCP socket

**Method**: Raw TCP socket connection
```javascript
const net = require('net');

function submitJCL(jclText) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(10000);
    
    client.connect(3505, '127.0.0.1', () => {
      // JCL must end with /* (end-of-data marker)
      const payload = jclText.trim() + '\n/*\n';
      
      client.write(payload, 'ascii', () => {
        client.end();
        resolve({ success: true });
      });
    });
    
    client.on('error', reject);
    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}
```

**Tested & Working**: ✓
- Successfully submitted TESTJOB and LISTCAT jobs
- Jobs appear in syslog immediately
- Jobs execute and complete (HASP373 → HASP395)

**JCL Format Requirements**:
```jcl
//JOBNAME  JOB (ACCT),'DESCRIPTION',CLASS=A,MSGCLASS=X
//STEP1    EXEC PGM=IEFBR14
/*
```

**Critical Rules**:
1. Job name: exactly 8 characters, UPPERCASE
2. Must end with `/*` on a separate line
3. Send as ASCII encoding
4. No tabs — spaces only
5. Statements in columns 1-72

---

### 2. **Port 8038 — HTTP Console (NOT 8081)** ⚠️ INCORRECT IN .ENV

**Purpose**: Query job status, send operator commands, view system log

**Correct Base URL**: `http://127.0.0.1:8038`

**Key Endpoints**:

#### A. System Log (with command interface)
```
GET  http://127.0.0.1:8038/cgi-bin/tasks/syslog
POST http://127.0.0.1:8038/cgi-bin/tasks/syslog
     Body: command=$DA&send=Send
```

#### B. Send Operator Commands
```bash
# Display active jobs
curl -X POST "http://127.0.0.1:8038/cgi-bin/tasks/syslog" \
  -d "command=\$DA&send=Send"

# Display specific job status
curl -X POST "http://127.0.0.1:8038/cgi-bin/tasks/syslog" \
  -d "command=\$DJ+JOBNAME&send=Send"

# Halt all jobs
curl -X POST "http://127.0.0.1:8038/cgi-bin/tasks/syslog" \
  -d "command=\$HA&send=Send"
```

#### C. Other Useful Endpoints
```
http://127.0.0.1:8038/tasks.html              # Task menu
http://127.0.0.1:8038/cgi-bin/tasks/ipl       # IPL status
http://127.0.0.1:8038/cgi-bin/debug/registers # CPU registers
http://127.0.0.1:8038/cgi-bin/debug/device/list # Device list
```

**Tested & Working**: ✓
- Successfully queried system log
- Commands accepted and processed
- Job completion messages visible

**Common JES2 Commands**:
| Command | Purpose |
|---------|---------|
| `$DA` | Display Active jobs |
| `$DJ jobname` | Display Job status |
| `$DO jobname` | Display Output |
| `$PJ jobname` | Purge Job from queue |
| `$HA` | Halt All jobs |
| `$C jobname` | Cancel job |

---

### 3. **Port 3270 — TN3270 Terminal** ✓ CORRECT

**Purpose**: Interactive 3270 terminal sessions (manual operations)

**Method**: Use a 3270 terminal emulator (x3270, wc3270, IBM Personal Communications)

**Not Used by Backend**: This is for interactive user sessions, not programmatic API calls.

---

## How to Query Job Status

### Method 1: Poll System Log (Recommended)

```javascript
const axios = require('axios');

async function getJobStatus(jobName) {
  const response = await axios.post(
    'http://127.0.0.1:8038/cgi-bin/tasks/syslog',
    `command=$DJ ${jobName}&send=Send`,
    { timeout: 5000 }
  );
  
  const log = response.data;
  
  // Parse for job completion
  if (log.includes(`$HASP395 ${jobName}`)) {
    // Job ended
    const rcMatch = log.match(/RC=(\d{4})/);
    const returnCode = rcMatch ? parseInt(rcMatch[1]) : null;
    
    return {
      status: 'COMPLETE',
      returnCode,
      completed: true
    };
  }
  
  if (log.includes(`$HASP373 ${jobName}`)) {
    return { status: 'RUNNING', completed: false };
  }
  
  return { status: 'UNKNOWN', completed: false };
}
```

### Method 2: Parse System Log for Completion

```javascript
async function pollUntilComplete(jobName, maxAttempts = 30, intervalMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(
      'http://127.0.0.1:8038/cgi-bin/tasks/syslog'
    );
    
    const log = response.data;
    
    // Check for job end marker
    const endPattern = new RegExp(`\\$HASP395 ${jobName}.*ENDED`);
    if (endPattern.test(log)) {
      // Extract return code
      const rcMatch = log.match(new RegExp(`${jobName}.*RC=(\\d{4})`));
      const returnCode = rcMatch ? parseInt(rcMatch[1]) : 0;
      
      return {
        status: 'COMPLETE',
        returnCode
      };
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return { status: 'TIMEOUT', completed: false };
}
```

---

## How to Retrieve SYSOUT Logs

SYSOUT from jobs appears in the Hercules system log. There is NO separate API endpoint for job output in Hercules TK5.

**Method**: Parse system log for job messages

```javascript
async function getJobOutput(jobName) {
  const response = await axios.get(
    'http://127.0.0.1:8038/cgi-bin/tasks/syslog'
  );
  
  const log = response.data;
  
  // Extract lines between job start and end
  const lines = log.split('\n');
  const jobLines = [];
  let inJob = false;
  
  for (const line of lines) {
    if (line.includes(`$HASP373 ${jobName}`)) {
      inJob = true;
    }
    if (inJob) {
      jobLines.push(line);
    }
    if (line.includes(`$HASP395 ${jobName}`)) {
      break;
    }
  }
  
  return jobLines.join('\n');
}
```

**Note**: For actual dataset content, you must submit a separate job that writes to a dataset, then use IEBGENER to print it to SYSOUT.

---

## How to Upload/Download Datasets

### Upload Dataset (File → MVS)

**Method**: Wrap file content in IEBGENER JCL and submit via port 3505

```javascript
function generateUploadJCL(dsn, fileContent, lrecl = 80) {
  // Pad each line to LRECL
  const paddedContent = fileContent
    .split('\n')
    .map(line => line.padEnd(lrecl).substring(0, lrecl))
    .join('\n');
  
  return `//UPLOAD   JOB (ACCT),'UPLOAD',CLASS=A,MSGCLASS=X
//STEP1    EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT1   DD *
${paddedContent}
/*
//SYSUT2   DD DSN=${dsn},
//            DISP=(NEW,CATLG,DELETE),
//            SPACE=(CYL,(1,1),RLSE),
//            DCB=(RECFM=FB,LRECL=${lrecl},BLKSIZE=${lrecl * 10})
//SYSIN    DD DUMMY
/*
`;
}

// Usage
const jcl = generateUploadJCL('STUDENT.INPUT.PS001', fileContent);
await submitJCL(jcl);
```

### Download Dataset (MVS → File)

**Method**: Submit job that prints dataset to SYSOUT via IEBGENER

```javascript
function generateDownloadJCL(dsn) {
  return `//DOWNLOAD JOB (ACCT),'DOWNLOAD',CLASS=A,MSGCLASS=X
//STEP1    EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT1   DD DSN=${dsn},DISP=SHR
//SYSUT2   DD SYSOUT=*
//SYSIN    DD DUMMY
/*
`;
}

// Submit and parse SYSOUT from system log
const jcl = generateDownloadJCL('STUDENT.OUTPUT.PS001');
await submitJCL(jcl);
await pollUntilComplete('DOWNLOAD');
const output = await getJobOutput('DOWNLOAD');
```

---

## Environment Variables — CORRECTED

Update your `.env` file with verified values:

```env
# Hercules TK5 Configuration (VERIFIED)
TK5_HOST=127.0.0.1
TK5_CARD_READER_PORT=3505        # ✓ CORRECT - JCL submission
TK5_HTTP_PORT=8038               # ⚠️ CHANGED from 8081 to 8038
TK5_TN3270_PORT=3270             # ✓ CORRECT - Terminal (not used by API)

# Dataset Configuration
TK5_DATASET_PREFIX=STUDENT

# Job Polling
JOB_POLL_INTERVAL_MS=2000
JOB_POLL_MAX_ATTEMPTS=30

# Mainframe Mode
MAINFRAME_MODE=auto              # auto | hercules | simulated
```

---

## Complete Workflow Example

```javascript
const net = require('net');
const axios = require('axios');

// 1. Submit JCL
async function submitJob(jcl) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(10000);
    
    client.connect(3505, '127.0.0.1', () => {
      client.write(jcl.trim() + '\n/*\n', 'ascii', () => {
        client.end();
        resolve({ success: true });
      });
    });
    
    client.on('error', reject);
  });
}

// 2. Poll for completion
async function waitForJob(jobName) {
  for (let i = 0; i < 30; i++) {
    const { data: log } = await axios.get(
      'http://127.0.0.1:8038/cgi-bin/tasks/syslog'
    );
    
    if (log.includes(`$HASP395 ${jobName}`)) {
      const rcMatch = log.match(new RegExp(`RC=(\\d{4})`));
      return {
        completed: true,
        returnCode: rcMatch ? parseInt(rcMatch[1]) : 0
      };
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return { completed: false, status: 'TIMEOUT' };
}

// 3. Execute complete workflow
async function runBatchJob() {
  const jcl = `//MYJOB    JOB (ACCT),'BATCH JOB',CLASS=A,MSGCLASS=X
//STEP1    EXEC PGM=SORT
//SORTIN   DD DSN=STUDENT.INPUT.PS,DISP=SHR
//SORTOUT  DD DSN=STUDENT.OUTPUT.PS,
//            DISP=(NEW,CATLG,DELETE),
//            SPACE=(CYL,(1,1),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)
//SYSIN    DD *
  SORT FIELDS=(1,80,CH,A)
/*
`;
  
  await submitJob(jcl);
  const result = await waitForJob('MYJOB');
  
  console.log('Job completed:', result);
}

runBatchJob().catch(console.error);
```

---

## Testing Commands

```bash
# Test card reader port
node -e "const net = require('net'); const s = new net.Socket(); s.connect(3505, '127.0.0.1', () => { console.log('✓ Port 3505 reachable'); s.end(); });"

# Test HTTP console
curl -s "http://127.0.0.1:8038/" | head -5

# Submit test job
node -e "
const net = require('net');
const client = new net.Socket();
client.connect(3505, '127.0.0.1', () => {
  client.write('//TESTJOB  JOB (ACCT),TEST\n//STEP1 EXEC PGM=IEFBR14\n/*\n', 'ascii', () => client.end());
});
"

# View system log
curl -s "http://127.0.0.1:8038/cgi-bin/tasks/syslog" | grep "HASP"
```

---

## Key Findings Summary

1. ✅ **Port 3505** (Card Reader) is CORRECT — use for JCL submission via TCP
2. ⚠️ **Port 8081** is WRONG — use **8038** for HTTP console
3. ✅ **Port 3270** (TN3270) is CORRECT — for terminal sessions only
4. Job status must be queried by parsing system log from HTTP console
5. No REST API for dataset operations — must use JCL jobs
6. All operations go through port 3505 (JCL) or 8038 (monitoring)

---

## References

- Hercules HTTP Console: http://127.0.0.1:8038/
- System Log: http://127.0.0.1:8038/cgi-bin/tasks/syslog
- Device List: http://127.0.0.1:8038/cgi-bin/debug/device/list
- JCL Submission: TCP port 3505 (raw socket)

---

*Generated: 2026-10-12*
*Verified with live Hercules TK5 instance*
