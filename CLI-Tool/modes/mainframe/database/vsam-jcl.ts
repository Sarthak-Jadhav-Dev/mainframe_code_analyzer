/**
 * Mainframe Database & VSAM Storage — IDCAMS JCL Templates
 * ---------------------------------------------------------
 * Generates JCL jobs for creating, populating, and querying the
 * VSAM KSDS (Key-Sequenced Data Set) on Hercules TK5 via IDCAMS.
 */

function makeJobCard(
    name: string,
    desc: string,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string[] {
    const pwdPart = password ? `,PASSWORD=${password}` : "";
    const cleanName = name.trim().slice(0, 8).toUpperCase();
    return [
        `//${cleanName} JOB (ACCT),'${desc.slice(0, 20)}',`,
        `//         CLASS=A,MSGCLASS=A,USER=${user}${pwdPart}`,
    ];
}

export const VSAM_CLUSTER_NAME = "HERC01.AUDIT.HIST.KSDS";
export const VSAM_DATASET_NAME = "HERC01.AUDIT.HIST.DATA";

/**
 * JCL to define the VSAM KSDS Cluster using IDCAMS on volume WORK01.
 * Deletes any existing cluster with MAXCC=0 before allocation.
 */
export function buildVsamDefineClusterJcl(
    jobName: string = "AUDVSDF1",
    clusterName: string = VSAM_CLUSTER_NAME,
    volume: string = "WORK01",
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    return [
        ...makeJobCard(jobName, "VSAM-DEF-KSDS", user, password),
        `//STEP01   EXEC PGM=IDCAMS`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSIN    DD *`,
        `  DELETE ${clusterName} CLUSTER PURGE`,
        `  SET MAXCC = 0`,
        `  DEFINE CLUSTER (NAME(${clusterName}) -`,
        `         INDEXED -`,
        `         KEYS(28 0) -`,
        `         RECORDSIZE(160 160) -`,
        `         VOLUMES(${volume}) -`,
        `         TRACKS(5 5) -`,
        `         FREESPACE(10 10) -`,
        `         SHAREOPTIONS(2 3)) -`,
        `       DATA (NAME(${clusterName}.DATA)) -`,
        `       INDEX (NAME(${clusterName}.INDEX))`,
        `/*`,
        "",
    ].join("\n");
}

/**
 * JCL to insert/load execution records into the VSAM KSDS using IDCAMS REPRO.
 * Records are inlined into SYSUT1 and copied directly into the cluster.
 */
export function buildVsamReproJcl(
    jobName: string = "AUDVSRP1",
    records: string[],
    clusterName: string = VSAM_CLUSTER_NAME,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const validRecords = records.map((r) => r.padEnd(160, " ").slice(0, 160));

    return [
        ...makeJobCard(jobName, "VSAM-REPRO-KSDS", user, password),
        `//STEP01   EXEC PGM=IDCAMS`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD *`,
        ...validRecords,
        `/*`,
        `//SYSIN    DD *`,
        `  REPRO INFILE(SYSUT1) -`,
        `        OUTDATASET(${clusterName})`,
        `/*`,
        "",
    ].join("\n");
}

