package com.tango.app.data

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class TangoViewModel(private val savedState: SavedStateHandle) : ViewModel() {
    private val corrected = savedState.get<ArrayList<String>>("corrected") ?: arrayListOf("dental")
    private val _records = MutableStateFlow(DemoRecords.messages.map { it.copy(corrected = it.id in corrected) })
    val records = _records.asStateFlow()
    private val _demo = MutableStateFlow(savedState["demo"] ?: false)
    val demo = _demo.asStateFlow()

    fun enableDemo() {
        _demo.value = true
        savedState["demo"] = true
    }
    fun correctMessage(id: String) {
        _records.value = _records.value.correct(id)
        savedState["corrected"] = ArrayList(_records.value.filter { it.corrected }.map { it.id })
    }
    fun resetDemo() {
        _records.value = DemoRecords.messages
        savedState["corrected"] = arrayListOf("dental")
        _demo.value = false
        savedState["demo"] = false
    }
}
