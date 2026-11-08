package com.tango.app.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.tango.app.WarningNotifications
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class TangoViewModel(application: Application, private val savedState: SavedStateHandle) : AndroidViewModel(application) {
    private val repository = MessageRepository.get(application)
    val loading = repository.loading
    val storageError = repository.error
    private val corrected = savedState.get<ArrayList<String>>("corrected") ?: arrayListOf("dental")
    private val examples = MutableStateFlow(DemoRecords.messages.map { it.copy(corrected = it.id in corrected) })
    private val _demo = MutableStateFlow(savedState.get<Boolean>("demo") ?: false)
    val demo = _demo.asStateFlow()
    val records = combine(repository.records, _demo, examples) { real, preview, samples -> if (preview) samples else real }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    private val _operationError = MutableStateFlow<String?>(null)
    val operationError = _operationError.asStateFlow()
    fun enableDemo() { _demo.value = true; savedState["demo"] = true }
    fun showLiveRecords() { _demo.value = false; savedState["demo"] = false }
    fun findRecord(id: String): MessageRecord? = if (id.startsWith("live-")) repository.records.value.firstOrNull { it.id == id }
        else examples.value.firstOrNull { it.id == id }
    fun correctMessage(id: String) {
        if (!id.startsWith("live-")) {
            examples.value = examples.value.correct(id)
            savedState["corrected"] = ArrayList(examples.value.filter { it.corrected }.map { it.id })
            return
        }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                repository.update(id) { it.copy(corrected = true) }
                WarningNotifications.cancel(getApplication<Application>(), id)
                _operationError.value = null
            } catch (_: Exception) { _operationError.value = "The correction could not be saved. Please try again." }
        }
    }
    fun clearLiveHistory() {
        viewModelScope.launch(Dispatchers.IO) {
            try { repository.clear(); WarningNotifications.clearLiveAlerts(getApplication<Application>()); _operationError.value = null }
            catch (_: Exception) { _operationError.value = "Message history could not be cleared." }
        }
    }
    fun resetDemo() {
        examples.value = DemoRecords.messages
        savedState["corrected"] = arrayListOf("dental")
        showLiveRecords()
    }
}
