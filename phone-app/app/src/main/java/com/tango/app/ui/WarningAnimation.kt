package com.tango.app.ui

import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.tango.app.R
import com.tango.app.data.MessageRecord
import com.tango.app.data.MessageRisk
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.sin

/** Same phase timings as the extension's TangoAlert, arranged for a portrait screen. */
@Composable
fun WarningAnimationScreen(message: MessageRecord, risk: MessageRisk, review: () -> Unit) {
    val high = risk == MessageRisk.HIGH
    val duration = if (high) 6240f else 2650f
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    var elapsed by rememberSaveable(message.id, risk.name) { mutableFloatStateOf(0f) }
    var muted by rememberSaveable { mutableStateOf(false) }
    fun motionScale(): Float = try {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f).coerceAtLeast(0f)
    } catch (_: Exception) { 1f }
    var scale by remember { mutableFloatStateOf(motionScale()) }
    val audio = remember(context) { WarningAudio(context) }
    DisposableEffect(lifecycle, audio) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) scale = motionScale()
            if (event == Lifecycle.Event.ON_PAUSE) audio.stopAll()
        }
        lifecycle.lifecycle.addObserver(observer)
        onDispose { lifecycle.lifecycle.removeObserver(observer); audio.close() }
    }
    LaunchedEffect(message.id, risk, scale, lifecycle) {
        if (scale == 0f) { elapsed = duration; audio.stopAll(); return@LaunchedEffect }
        lifecycle.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            var previous = 0L
            while (elapsed < duration) {
                val frame = withFrameNanos { it }
                if (previous != 0L) elapsed = min(duration, elapsed + ((frame - previous) / 1_000_000f).coerceAtMost(50f) / scale)
                previous = frame
            }
        }
    }
    val rollAt = if (high) 2000f else 0f
    val popAt = rollAt + 1500f
    val slashAt = 4150f
    val slideAt = if (high) 5790f else 2200f
    val finished = elapsed >= duration
    val soundCue = when {
        finished -> "done"
        high && elapsed >= slashAt && elapsed < slashAt + 650f -> "cut-${floor((elapsed - slashAt - 150f) / 110f).toInt().coerceIn(-1, 3)}"
        elapsed >= popAt -> "pop"
        elapsed >= rollAt -> "roll"
        else -> "waiting"
    }
    val played = remember(message.id, risk.name) { mutableSetOf<String>() }
    LaunchedEffect(soundCue, muted, scale) {
        if (muted || scale == 0f || finished) { audio.stopAll(); return@LaunchedEffect }
        if (played.add(soundCue)) when {
            soundCue == "roll" -> audio.play("roll")
            soundCue == "pop" -> { audio.stopAll(); audio.play("pop") }
            soundCue.startsWith("cut-") && soundCue != "cut--1" -> audio.play("slash")
        }
    }
    val phase = when {
        finished -> "The clues, not just a label."
        elapsed >= slideAt -> "Let’s take a closer look."
        high && elapsed >= slashAt -> "Interrupting the threat…"
        elapsed >= popAt -> "On guard."
        elapsed >= rollAt -> "Tango is rolling in…"
        else -> "Something suspicious is hiding here…"
    }
    val dim = if (!high) 1f else ((elapsed - 400f) / 1600f).coerceIn(0f, 1f)
    Column(Modifier.fillMaxSize().background(Color(0xFF15151B).copy(alpha = .60f * dim))
        .verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Badge("${if (message.isDemo) "Demo" else "Local check"} · ${if (high) "High" else "Medium"} risk", if (high) Color(0xFFB42318) else Amber,
            if (high) Color(0xFFFDE7E8) else AmberTint)
        Text(phase, color = if (dim > .5f) Color.White else Ink, style = MaterialTheme.typography.titleLarge)
        WarningStage(elapsed, high, Modifier.fillMaxWidth().heightIn(min = 250.dp, max = 340.dp).aspectRatio(390f / 340f))
        if (!finished) {
            Surface(color = Color.White.copy(alpha = .94f), shape = MaterialTheme.shapes.large) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(message.title, style = MaterialTheme.typography.titleMedium)
                    Body(if (message.isDemo) "This animation uses a fictional message. No real message or link is being changed." else "Local checks flagged this notification preview. The original message remains in your messaging inbox.")
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextAction(if (muted) "Sound off" else "Sound on") { muted = !muted }
                        TextAction("Skip animation") { elapsed = duration; audio.stopAll() }
                    }
                }
            }
        } else {
            var step by rememberSaveable(message.id, risk.name) { mutableIntStateOf(0) }
            Panel {
                if (step == 0) {
                    Eyebrow("Understand the warning")
                    Text(message.title, style = MaterialTheme.typography.headlineMedium)
                    message.clues.take(3).forEach { clue ->
                        Text(clue.title, style = MaterialTheme.typography.titleMedium)
                        Body(clue.detail)
                    }
                    PrimaryButton("Next · protection tip") { step = 1 }
                    TextAction("Open message review", review)
                } else {
                    Eyebrow("A safer next step")
                    Text(message.adviceTitle, style = MaterialTheme.typography.titleLarge)
                    Body(message.advice)
                    Body("T-Mobile’s call-protection services are explained in the full report. They do not delete or resolve the original text.")
                    PrimaryButton("Review message", AppIcons.ArrowForward, onClick = review)
                    TextAction("Back to the clues") { step = 0 }
                }
                Body(if (message.isDemo) "Demo only. The original message stays in the messaging inbox." else "A warning is not proof of a scam. Review the clues; your original message is unchanged.")
            }
        }
    }
}

@Composable
private fun WarningStage(time: Float, high: Boolean, modifier: Modifier) {
    val body = ImageBitmap.imageResource(if (high) R.drawable.character_angry else R.drawable.character_suspicious)
    val hornet = ImageBitmap.imageResource(R.drawable.animation_hornet)
    val legLeft = ImageBitmap.imageResource(R.drawable.animation_leg_left)
    val legRight = ImageBitmap.imageResource(R.drawable.animation_leg_right)
    val armHip = ImageBitmap.imageResource(R.drawable.animation_arm_hip)
    val armSword = ImageBitmap.imageResource(R.drawable.animation_arm_sword)
    val armPoint = ImageBitmap.imageResource(R.drawable.animation_arm_point)
    Canvas(modifier.clipToBounds().semantics { contentDescription = if (high) "Tango rolls in and cuts apart a demo hornet" else "Tango rolls in to explain the warning" }) {
        val unit = min(size.width / 390f, size.height / 340f)
        withTransform({ translate((size.width - 390f * unit) / 2f, (size.height - 340f * unit) / 2f); scale(unit, unit, Offset.Zero) }) {
            val rollAt = if (high) 2000f else 0f
            val popAt = rollAt + 1500f
            val slideAt = if (high) 5790f else 2200f
            val roll = progress(time, rollAt, 1500f)
            val landed = if (high) 245f else 195f
            val initial = if (high) 620f else -240f
            val center = mix(initial, landed, ease(roll))
            val slide = ease(progress(time, slideAt, 450f))
            val attack = progress(time, 4150f, 650f)
            val lunge = if (high && time in 4150f..4800f) -30f * sin(attack * PI).toFloat() else 0f
            val x = mix(center, 195f, slide) - 75f + lunge
            val y = 115f
            val pop = progress(time, popAt, 380f)
            val limbScale = (pop * 1.3f).coerceAtMost(1f) + sin(pop * PI).toFloat() * .12f
            if (time >= popAt) {
                sprite(legLeft, x + 41f, y + 136f, 27f, growth = limbScale, pivotX = .8f, pivotY = 0f)
                sprite(legRight, x + 82f, y + 136f, 35f, growth = limbScale, pivotX = .15f, pivotY = 0f)
                if (high) {
                    val swing = if (time in 4150f..4800f) sin(attack * PI * 6).toFloat() * 85f else 0f
                    sprite(armSword, x - 43f, y + 9f, 59f, rotation = swing, growth = limbScale, pivotX = .97f, pivotY = .88f)
                } else sprite(armHip, x - 38f, y + 64f, 52f, growth = limbScale, pivotX = .96f, pivotY = .08f)
                sprite(armPoint, x + 134f, y + 13f, 54f, growth = limbScale, pivotX = .03f, pivotY = .91f)
            }
            if (time >= rollAt) {
                val squash = sin(progress(time, popAt, 350f) * PI).toFloat()
                withTransform({ scale(1f + squash * .08f, 1f - squash * .1f, Offset(x + 75f, y + 150f)) }) {
                    sprite(body, x, y, 150f, rotation = (1f - roll) * if (high) 720f else -720f, squareCrop = true)
                }
            }
            if (high && time < slideAt) drawHornet(hornet, time)
        }
    }
}

private fun progress(time: Float, start: Float, duration: Float) = ((time - start) / duration).coerceIn(0f, 1f)
private fun ease(value: Float) = 1f - (1f - value) * (1f - value) * (1f - value)
private fun mix(start: Float, end: Float, value: Float) = start + (end - start) * value

private fun DrawScope.sprite(image: ImageBitmap, x: Float, y: Float, width: Float, rotation: Float = 0f,
                             growth: Float = 1f, pivotX: Float = .5f, pivotY: Float = .5f, squareCrop: Boolean = false) {
    val crop = if (squareCrop) (min(image.width, image.height) * (2f / 3f)).toInt() else 0
    val source = if (squareCrop) IntSize(crop, crop) else IntSize(image.width, image.height)
    val sourceOffset = if (squareCrop) IntOffset((image.width - crop) / 2, (image.height - crop) / 2) else IntOffset.Zero
    val height = if (squareCrop) width else width * image.height / image.width
    withTransform({
        translate(x, y)
        val pivot = Offset(width * pivotX, height * pivotY)
        rotate(rotation, pivot); scale(growth, growth, pivot)
    }) {
        drawImage(image, srcOffset = sourceOffset, srcSize = source, dstSize = IntSize(width.toInt(), height.toInt()))
    }
}

private fun DrawScope.drawHornet(image: ImageBitmap, time: Float) {
    val flight = progress(time, 0f, 2400f)
    val x = mix(10f, 25f, ease(flight)) + sin(flight * PI * 4).toFloat() * (1f - flight) * 85f
    val y = mix(280f, 58f, ease(flight)) + sin(flight * PI * 3).toFloat() * 35f * (1f - flight)
    val width = 170f
    val height = width * image.height / image.width
    val cuts = listOf(0f to 0f, .26f to .06f, .44f to .38f, .72f to .50f, .88f to .84f, 1f to 1f)
    val vectors = listOf(-90f to -250f, -230f to -150f, -280f to 20f, -220f to 180f, -80f to 270f)
    for (index in 0..4) {
        val delay = 4150f + (150f + index * 110f).coerceAtMost(480f)
        val fly = ease(progress(time, delay, 1000f))
        val shift = vectors[index]
        withTransform({
            translate(x + shift.first * fly, y + shift.second * fly)
            rotate((index - 2) * 24f * fly, Offset(width / 2f, height / 2f))
        }) {
            val top = cuts[index]
            val bottom = cuts[index + 1]
            val path = Path().apply {
                moveTo(0f, top.first * height); lineTo(width, top.second * height)
                lineTo(width, bottom.second * height); lineTo(0f, bottom.first * height); close()
            }
            clipPath(path) {
                drawImage(image, dstSize = IntSize(width.toInt(), height.toInt()), alpha = 1f - fly)
            }
        }
        val flash = progress(time, delay - 60f, 180f)
        if (flash > 0f && flash < 1f) {
            val cut = cuts[index + 1]
            drawLine(Color(0xFFFFE5F4).copy(alpha = 1f - flash), Offset(x - 10f, y + cut.first * height),
                Offset(x + width + 10f, y + cut.second * height), strokeWidth = 4f)
        }
    }
}
