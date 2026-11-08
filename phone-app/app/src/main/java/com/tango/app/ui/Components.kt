package com.tango.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.tango.app.R
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CharacterAvatar(size: Int = 26) {
    Box(Modifier.size(size.dp).clipToBounds()) {
        Image(
            painter = painterResource(R.drawable.t_mobile_light_mode),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = 1.5f; scaleY = 1.5f },
        )
    }
}

@Composable
fun Eyebrow(text: String, color: Color = Pink) {
    Text(text.uppercase(), color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
}

@Composable
fun Heading(eyebrow: String, title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Eyebrow(eyebrow)
        Text(title, style = MaterialTheme.typography.headlineLarge)
        subtitle?.let { Text(it, color = Muted, style = MaterialTheme.typography.bodyMedium) }
    }
}

@Composable
fun Panel(color: Color = MaterialTheme.colorScheme.surface, content: @Composable ColumnScope.() -> Unit) {
    Surface(shape = RoundedCornerShape(22.dp), color = color, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
    }
}

@Composable
fun Body(text: String, color: Color = Muted) { Text(text, color = color, style = MaterialTheme.typography.bodyMedium) }

@Composable
fun Badge(text: String, color: Color = Muted, background: Color = Background) {
    Surface(color = background, shape = RoundedCornerShape(50)) {
        Text(text, Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = color,
            fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun PrimaryButton(text: String, icon: ImageVector? = null, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), shape = RoundedCornerShape(50)) {
        icon?.let { Icon(it, null, Modifier.size(19.dp)); Spacer(Modifier.width(10.dp)) }
        Text(text)
    }
}

@Composable
fun SecondaryButton(text: String, icon: ImageVector? = null, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = MaterialTheme.colorScheme.surface),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp)) {
        icon?.let { Icon(it, null, Modifier.size(19.dp)); Spacer(Modifier.width(10.dp)) }
        Text(text)
    }
}

@Composable
fun TextAction(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, contentPadding = PaddingValues(0.dp)) { Text(text) }
}

@Composable
fun StatusRow(icon: ImageVector, title: String, subtitle: String, status: String, active: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, tint = if (active) Green else Muted, modifier = Modifier.size(22.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Body(subtitle)
        }
        Badge(status, if (active) Green else Muted, if (active) GreenTint else Background)
    }
}

@Composable
fun HornetsCard(count: Int, period: String = "NOVEMBER SO FAR", detail: String = "Unique attempts interrupted. Each counts once.") {
    Panel(Color(0xFF18121F)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(period, color = Color(0xFFBBBBCA), fontSize = 11.sp)
            CharacterAvatar(36)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(count.toString(), color = Color.White, fontSize = 58.sp, lineHeight = 65.sp)
            Column(Modifier.weight(1f)) {
                Text("Hornets defeated", color = Color.White, style = MaterialTheme.typography.titleLarge)
                Text(detail, color = Color(0xFFBBBBCA), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
