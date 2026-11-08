package com.tango.app.data

import org.junit.Assert.*
import org.junit.Test

class HornetNestTest {
    @Test fun normalizesLikeTheExtensionAndWebsite() {
        assertEquals("fake-prize-demo.example", normalizeDomain(" https://www.Fake-Prize-Demo.example/claim?x=1 "))
        assertEquals("shop.example", normalizeDomain("shop.example"))
        assertEquals("shop.example", normalizeDomain("http://shop.example:8080/cart"))
        assertNull(normalizeDomain(""))
        assertNull(normalizeDomain("not a site"))
        assertNull(normalizeDomain("localhost"))
        assertNull(normalizeDomain("ftp://files.example"))
        assertNull(normalizeDomain("https://user:pass@bank.example"))
    }
    @Test fun categoryIdsMatchTheBackend() {
        assertEquals(listOf("phishing", "shopping", "job", "scholarship", "impersonation", "other"), ReportCategory.entries.map { it.id })
    }
    @Test fun reportCountReadsNaturally() {
        assertEquals("1 person has", reportsLabel(1))
        assertEquals("4 people have", reportsLabel(4))
    }
}
