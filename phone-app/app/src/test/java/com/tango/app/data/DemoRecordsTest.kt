package com.tango.app.data

import org.junit.Assert.*
import org.junit.Test

class DemoRecordsTest {
    @Test fun totalsCountUniqueAttemptsNotActions() {
        val records = DemoRecords.messages
        assertEquals(4, records.size)
        assertEquals(3, records.hornetsDefeated())
        assertTrue(records.first().domainBlocked)
        assertEquals(3, (records + records.first()).hornetsDefeated())
    }
    @Test fun correctionUpdatesFiltersAndHornetsWithoutChangingMessage() {
        val before = DemoRecords.messages
        val after = before.correct("delivery")
        assertEquals(2, after.hornetsDefeated())
        assertEquals(2, after.filtered(HistoryFilter.Corrected).size)
        assertEquals(2, after.filtered(HistoryFilter.Flagged).size)
        assertEquals(before.first().preview, after.first().preview)
        assertEquals(3, before.hornetsDefeated())
        assertEquals(after, after.correct("delivery"))
    }
    @Test fun sharePreviewContainsOnlyAllowedThreatIndicators() {
        val message = DemoRecords.messages.first()
        val indicators = message.sharingPreview()!!
        assertEquals(message.domain, indicators.domain)
        assertEquals(message.category, indicators.category)
        assertEquals(message.tags, indicators.reasonTags)
        assertFalse(indicators.toString().contains(message.sender))
        assertFalse(indicators.toString().contains(message.preview))
        assertNull(message.copy(corrected = true).sharingPreview())
        assertNull(DemoRecords.messages.last().sharingPreview())
    }
    @Test fun linksAreDefangedForReview() {
        assertEquals("hxxps://parce1-release[.]example/pay", DemoRecords.messages.first().neutralizedLink)
        assertNull(DemoRecords.messages.last().neutralizedLink)
        assertTrue(DemoRecords.messages.all { !it.preview.contains("https://") })
    }
}
