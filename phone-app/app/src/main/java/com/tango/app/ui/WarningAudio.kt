package com.tango.app.ui

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.tango.app.R

/** Short local sound effects; never reads messages or requests audio permissions. */
internal class WarningAudio(context: Context) {
    private val pool = SoundPool.Builder().setMaxStreams(5).setAudioAttributes(
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
    ).build()
    private val sounds = mutableMapOf<String, Int>()
    private val loaded = mutableSetOf<Int>()
    private val pending = mutableSetOf<String>()
    private val streams = mutableListOf<Int>()
    private var closed = false
    init {
        pool.setOnLoadCompleteListener { _, id, status ->
            if (!closed && status == 0) {
                loaded.add(id)
                val name = sounds.entries.firstOrNull { it.value == id }?.key
                if (name != null && pending.remove(name)) play(name)
            }
        }
        sounds["roll"] = pool.load(context, R.raw.animation_roll, 1)
        sounds["pop"] = pool.load(context, R.raw.animation_pop, 1)
        sounds["slash"] = pool.load(context, R.raw.animation_slash, 1)
    }
    fun play(name: String) {
        if (closed) return
        val id = sounds[name] ?: return
        if (id !in loaded) { pending.add(name); return }
        streams.add(pool.play(id, .45f, .45f, 1, 0, 1f))
    }
    fun stopAll() {
        pending.clear()
        streams.forEach { pool.stop(it) }
        streams.clear()
    }
    fun close() {
        stopAll()
        closed = true
        pool.setOnLoadCompleteListener(null)
        pool.release()
    }
}
