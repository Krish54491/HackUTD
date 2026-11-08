package com.tango.app.data

enum class MessageRisk { NONE, LOW, MEDIUM, HIGH }

data class Clue(val title: String, val detail: String)
data class MessageRecord(
    val id: String,
    val title: String,
    val domain: String?,
    val time: String,
    val category: String,
    val sender: String,
    val preview: String,
    val tags: List<String>,
    val clues: List<Clue>,
    val adviceTitle: String,
    val advice: String,
    val corrected: Boolean = false,
    val domainBlocked: Boolean = false,
    val risk: MessageRisk = MessageRisk.HIGH,
    val isDemo: Boolean = true,
    val receivedAt: Long = 0L,
    val sourcePackage: String = "",
    val url: String? = null,
    val warningPosted: Boolean = false,
    val dismissalRequested: Boolean = false,
    val originalAlertHidden: Boolean = false,
) {
    val neutralizedLink: String? get() = (url ?: domain?.let { "https://$it/pay" })?.let(::defangUrl)
    val displayPreview: String get() = URL_PATTERN.replace(preview) { defangUrl(it.value) }
    val protectionAction: String get() = when {
        isDemo -> "Warning shown (demo)"
        originalAlertHidden -> "Warning shown · original alert hidden"
        dismissalRequested -> "Warning shown · original dismissal requested"
        warningPosted -> "Warning shown · original alert retained"
        else -> "Flagged locally · warning alerts unavailable"
    }
    fun sharingPreview(): ThreatIndicators? = if (corrected || domain == null) null else ThreatIndicators(domain, category, tags)
}
// Only this allowlisted payload may cross a future sharing boundary.
// Sender, message text and personal details are intentionally absent.
private val URL_PATTERN = Regex("""(?i)\b(?:https?://|www\.)[^\s<>]+""")
private fun defangUrl(value: String): String = value.replace(Regex("(?i)^https"), "hxxps")
    .replace(Regex("(?i)^http"), "hxxp").replace(".", "[.]")

data class ThreatIndicators(val domain: String, val category: String, val reasonTags: List<String>)
enum class HistoryFilter { All, Flagged, Corrected }
fun List<MessageRecord>.filtered(filter: HistoryFilter): List<MessageRecord> = filter {
    when (filter) {
        HistoryFilter.All -> true
        HistoryFilter.Flagged -> !it.corrected
        HistoryFilter.Corrected -> it.corrected
    }
}
fun List<MessageRecord>.hornetsDefeated(): Int = filter { !it.corrected && (it.isDemo || it.warningPosted || it.originalAlertHidden) }.distinctBy { it.id }.size
fun List<MessageRecord>.correct(id: String): List<MessageRecord> = map { if (it.id == id) it.copy(corrected = true) else it }

object DemoRecords {
    val messages = listOf(
        MessageRecord(
            id = "delivery", title = "Unexpected delivery fee", domain = "parce1-release.example",
            time = "Nov 7 · 10:42 AM", category = "Delivery-fee scam", sender = "+1 (202) 555-0148",
            preview = "Parcel notice: Your delivery is on hold. Pay a $1.99 redelivery fee within 2 hours or your parcel will be returned.",
            tags = listOf("Urgency", "Unexpected fee", "Lookalike link"),
            clues = listOf(
                Clue("Pressure to act quickly", "“Within 2 hours” and “will be returned” create urgency. Pressure is an indicator, not proof."),
                Clue("An unexpected payment request", "A $1.99 fee from an unfamiliar sender asks you to pay through a message link."),
                Clue("A lookalike domain", "“parce1” uses the digit 1 in a parcel-like name. A convincing name does not establish who sent it."),
            ),
            adviceTitle = "Expecting a parcel?",
            advice = "Check the retailer’s app or use contact details you already trust. Don’t pay or reply through this message.",
            domainBlocked = true,
        ),
        MessageRecord(
            "account", "Account verification request", "account-verifyf.example", "Nov 6 · 4:18 PM",
            "Account phishing", "+1 (202) 555-0123",
            "Your account has been suspended. Verify your password now to restore access.",
            listOf("Urgency", "Password request", "Unfamiliar domain"),
            listOf(Clue("An urgent account warning", "The message pressures you to restore access immediately."),
                Clue("A request for credentials", "It asks for a password through an unfamiliar link. Verify through the official app.")),
            "Concerned about your account?", "Open the official app yourself. Never enter a password through an unsolicited message link.",
            risk = MessageRisk.MEDIUM,
        ),
        MessageRecord(
            "prize", "Prize claim payment", "prize-claim.example", "Nov 5 · 9:24 AM",
            "Advance-fee scam", "+1 (202) 555-0179",
            "Congratulations! You won a prize. Send a gift card to pay the processing fee and claim it today.",
            listOf("Gift-card request", "Unexpected prize", "Upfront fee"),
            listOf(Clue("Paying to receive a prize", "An unexpected prize asks for payment before you can claim it."),
                Clue("A gift-card payment request", "Gift cards are difficult to recover once the code is shared. This is a warning sign.")),
            "Asked to pay for a prize?", "Do not send gift-card codes or money. Verify the organization through trusted contact details.",
        ),
        MessageRecord(
            "dental", "Dental appointment reminder", null, "Nov 4 · 2:06 PM", "Unfamiliar sender",
            "+1 (202) 555-0181", "Reminder: Your dental appointment is tomorrow at 2 PM. Call our office if you need to reschedule.",
            emptyList(), listOf(Clue("Reviewed by you", "You recognized this appointment reminder and marked it as not a scam.")),
            "Know the sender?", "Verify unfamiliar reminders using a number you already trust.", corrected = true, risk = MessageRisk.NONE,
        ),
    )
}
