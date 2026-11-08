package com.tango.app.data

import java.net.URI
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Inspects notification text locally. No contacts, inbox, network calls, or cloud classification. */
object LocalScamDetector {
    private val urls = Regex("""(?i)\b(?:https?://|www\.)[^\s<>]+""")
    fun fingerprint(source: String, sender: String, text: String, messageTime: Long): String {
        val bytes = "$source\u0000$sender\u0000$text\u0000$messageTime".toByteArray(Charsets.UTF_8)
        return "live-" + MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    }
    fun inspect(source: String, sender: String, text: String, messageTime: Long, receivedAt: Long): MessageRecord? {
        if (text.isBlank()) return null
        val content = text.take(8000)
        val clues = mutableListOf<Clue>()
        val tags = mutableListOf<String>()
        var score = 0
        fun signal(tag: String, title: String, detail: String, points: Int) {
            tags.add(tag); clues.add(Clue(title, detail)); score += points
        }
        fun matches(pattern: String) = Regex(pattern, setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)).containsMatchIn(content)
        if (matches("""\b(act now|urgent|immediately|account (?:is )?suspended|within\s+\d+\s*(?:hours?|minutes?))\b""")) {
            signal("Urgency", "Pressure to act quickly", "The preview uses an urgent demand, deadline, or account-suspension claim. This is an indicator, not proof.", 1)
        }
        if (matches("""\b(pay|payment|fee|transfer|crypto|bitcoin|wallet|redelivery fee|processing charge)\b""")) {
            signal("Payment request", "A payment-related request", "The preview mentions a payment, fee, transfer, or cryptocurrency. Verify it using contact details you already trust.", 2)
        }
        if (matches("""\b(pay|send|buy|purchase)\b.{0,60}\bgift\s*cards?\b|\bgift\s*cards?\b.{0,60}\b(payment|pay|send)\b""")) {
            signal("Gift-card request", "Gift cards requested as payment", "A request to buy or send gift cards as payment is a strong warning sign. Do not share gift-card codes.", 4)
        }
        if (matches("""\b(verify|confirm|send|enter|share)\b.{0,60}\b(password|bank login|bank details|verification code|security code)\b""")) {
            signal("Credentials requested", "Sensitive details requested", "The preview asks you to verify, enter, or share credentials or sensitive details. Check through the official app instead.", 2)
        }
        if (matches("""\b(you(?:'ve| have)? won|claim (?:your |a )?prize|prize winner|guaranteed grant|guaranteed reward)\b""")) {
            signal("Unexpected prize", "An unexpected prize or reward", "An unsolicited prize or guaranteed award should be verified independently, especially if a fee is requested.", 2)
        }
        val url = urls.find(content)?.value?.trimEnd('.', ',', ')', '!', ';')
        val domain = url?.let { value ->
            runCatching { URI(if (value.startsWith("www.", true)) "https://$value" else value).host?.lowercase(Locale.ROOT) }.getOrNull()
        }
        if (domain != null && domain in setOf("bit.ly", "tinyurl.com", "t.co", "rb.gy", "is.gd", "shorturl.at")) {
            signal("Shortened link", "The destination is hidden by a shortened link", "This short link hides the final destination. Shortened links are not proof of a scam on their own.", 1)
        }
        if (domain != null && Regex("""(?i)(paypa1|parce1|micr0soft|g00gle|amaz0n|app1e)""").containsMatchIn(domain)) {
            signal("Lookalike link", "A lookalike domain", "The link contains a brand-like word with substituted digits. A familiar-looking name does not establish who sent it.", 2)
        }
        // A single indicator never hides a notification. Require at least two independent clues.
        if (score < 3 || clues.size < 2) return null
        val delivery = matches("""\b(parcel|delivery|redelivery|package)\b""")
        val account = matches("""\b(account|password|login|verification)\b""")
        val category = when { delivery -> "Delivery-fee scam"; account -> "Account phishing"; else -> "Suspicious payment or reward" }
        val risk = if (score >= 5) MessageRisk.HIGH else MessageRisk.MEDIUM
        return MessageRecord(
            id = fingerprint(source, sender, content, messageTime),
            title = when { delivery -> "Suspicious delivery request"; account -> "Suspicious account request"; else -> "Suspicious message detected" },
            domain = domain, time = DateTimeFormatter.ofPattern("MMM d · h:mm a", Locale.getDefault())
                .withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(receivedAt)),
            category = category, sender = sender.ifBlank { "Sender not available" }, preview = content,
            tags = tags, clues = clues, adviceTitle = "Check through a trusted channel",
            advice = "Open the company's official app or contact it using details you already trust. Do not pay, reply, or enter credentials through this message.",
            risk = risk, isDemo = false, receivedAt = receivedAt, sourcePackage = source, url = url,
        )
    }
}
