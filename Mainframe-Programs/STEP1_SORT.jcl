//AUDSO01  JOB (ACCT),'STEP1-SORT',CLASS=A,MSGCLASS=X
//*===================================================================*
//* REQUIREMENT 1: JCL SORT                                           *
//* SORTS THE PLOTORIS FLAT FILE BY TECH_NAME (COLS 41-50)            *
//* TO PREPARE FOR COBOL MATCH-MERGE AGAINST TECHREF.                 *
//*===================================================================*
//STEP01   EXEC PGM=SORT
//SYSOUT   DD SYSOUT=*
//SORTIN   DD DSN=STUDENT.AUDIT.INPUT,DISP=SHR
//SORTOUT  DD DSN=STUDENT.AUDIT.SORTED,
//            DISP=(NEW,CATLG,DELETE),
//            SPACE=(CYL,(1,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)
//SYSIN    DD *
  SORT FIELDS=(41,10,CH,A,1,40,CH,A)
/*
