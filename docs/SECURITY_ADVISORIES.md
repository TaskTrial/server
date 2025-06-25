# Security Advisories

This document contains information about security vulnerabilities that have been addressed in this project.

## Multer DoS Vulnerability (CVE-2025-47944)

**Date Fixed:** 2025-06-25

### Description

A vulnerability in Multer versions >=1.4.4-lts.1 and <2.0.0 allows an attacker to trigger a Denial of Service (DoS) by sending a malformed multi-part upload request. This request causes an unhandled exception, leading to a crash of the process.

### Impact

This vulnerability could allow an attacker to cause the server to crash by sending specially crafted multipart form requests, potentially leading to service disruption.

### Resolution

Updated Multer from version 1.4.5-lts.2 to version 2.0.0, which patches this vulnerability.

### References

- [CVE-2025-47944](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-47944)

## Multer Memory Leak (CVE-2025-47935)

**Date Fixed:** 2025-06-25

### Description

Multer versions <2.0.0 are vulnerable to denial of service due to a memory leak caused by improper stream handling. When the HTTP request stream emits an error, the internal `busboy` stream is not closed, violating Node.js stream safety guidance.

### Impact

This leads to unclosed streams accumulating over time, consuming memory and file descriptors. Under sustained or repeated failure conditions, this can result in denial of service, requiring manual server restarts to recover.

### Resolution

Updated Multer from version 1.4.5-lts.2 to version 2.0.0, which patches this vulnerability.

### References

- [CVE-2025-47935](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-47935)
