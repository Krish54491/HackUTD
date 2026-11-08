package com.protego.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.protego.app.data.DemoRecords

@Composable
private fun PreviewFrame(content: @Composable ColumnScope.() -> Unit) {
    ProtegoTheme {
        Surface(color = Background) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp), content = content)
        }
    }
}

@Preview(name = "Protection setup", widthDp = 393, heightDp = 852)
@Composable
private fun SetupPreview() = PreviewFrame {
    SetupScreen(true, false, {}, {}, {}, {}, {})
}

@Preview(name = "Home · demo", widthDp = 393, heightDp = 852)
@Composable
private fun HomePreview() = PreviewFrame {
    HomeScreen(DemoRecords.messages, true, true, true, {}, {}, {}, {})
}

@Preview(name = "Message review", widthDp = 393, heightDp = 852)
@Composable
private fun ReviewPreview() = PreviewFrame {
    ReviewScreen(DemoRecords.messages.first(), {}, {}, {})
}

@Preview(name = "Why flagged", widthDp = 393, heightDp = 852)
@Composable
private fun ExplanationPreview() = PreviewFrame {
    ExplanationScreen(DemoRecords.messages.first(), {})
}

@Preview(name = "History", widthDp = 393, heightDp = 852)
@Composable
private fun HistoryPreview() = PreviewFrame {
    HistoryScreen(DemoRecords.messages, {})
}

@Preview(name = "Sharing preview", widthDp = 393, heightDp = 852)
@Composable
private fun SharingPreview() = PreviewFrame {
    ShareScreen(DemoRecords.messages.first(), {}, {})
}

@Preview(name = "Settings", widthDp = 393, heightDp = 852)
@Composable
private fun SettingsPreview() = PreviewFrame {
    SettingsScreen(true, true, true, {}, {}, {}, {})
}
