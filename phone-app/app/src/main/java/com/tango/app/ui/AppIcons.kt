package com.tango.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** Small code-native outline icon set; avoids shipping the full Material icon catalog. */
object AppIcons {
    private fun outline(name: String, path: String): ImageVector = ImageVector.Builder(
        name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f,
    ).addPath(
        pathData = addPathNodes(path), pathFillType = PathFillType.NonZero,
        fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 1.7f,
        strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
    ).build()

    val Shield = outline("Shield", "M12,3 L20,6 V12 C20,17 16,20 12,22 C8,20 4,17 4,12 V6 Z M9,12 L11,14 L15,10")
    val History = outline("History", "M3,11 A9,9 0,1 1,5,18 M3,4 V11 H10 M12,7 V12 L16,14")
    val Settings = outline("Settings", "M10,3 H14 L15,6 L18,7 L21,8 V12 L18,14 L17,17 L15,18 L14,21 H10 L9,18 L6,17 L3,15 V11 L6,9 L7,6 Z M16,12 A4,4 0,1 1,8,12 A4,4 0,1 1,16,12")
    val ArrowBack = outline("ArrowBack", "M20,12 H4 M10,6 L4,12 L10,18")
    val ArrowForward = outline("ArrowForward", "M4,12 H20 M14,6 L20,12 L14,18")
    val Notifications = outline("Notifications", "M5,17 H19 L17,14 V9 A5,5 0,0 0,7,9 V14 Z M10,21 H14")
    val NotificationsActive = outline("NotificationsActive", "M5,17 H19 L17,14 V9 A5,5 0,0 0,7,9 V14 Z M10,21 H14 M3,10 C3,7 4,5 6,4 M21,10 C21,7 20,5 18,4")
    val ChatBubbleOutline = outline("Message", "M4,4 H20 V17 H9 L4,21 Z")
    val SmsFailed = outline("FlaggedMessage", "M4,4 H20 V17 H9 L4,21 Z M12,8 V11 M12,14 V14.1")
    val ChevronRight = outline("ChevronRight", "M9,5 L16,12 L9,19")
    val PlayArrow = outline("Play", "M7,4 L20,12 L7,20 Z")
    val RestartAlt = outline("Reset", "M4,10 A8,8 0,1 1,5,18 M4,4 V10 H10")
    val Share = outline("Share", "M8,11 L16,6 M8,13 L16,18 M9,12 A3,3 0,1 1,3,12 A3,3 0,1 1,9,12 M22,5 A3,3 0,1 1,16,5 A3,3 0,1 1,22,5 M22,19 A3,3 0,1 1,16,19 A3,3 0,1 1,22,19")
    val WarningAmber = outline("Warning", "M12,3 L22,21 H2 Z M12,9 V14 M12,17 V17.2")
    val CheckCircle = outline("Corrected", "M22,12 A10,10 0,1 1,2,12 A10,10 0,1 1,22,12 M7,12 L10,15 L17,8")
    val LinkOff = outline("LinkDisabled", "M3,3 L21,21 M8,7 H6 A5,5 0,0 0,6,17 H9 M16,7 H18 A5,5 0,0 1,21,16 M10,12 H14")
    val QrCodeScanner = outline("LinkChecks", "M3,8 V3 H8 M16,3 H21 V8 M21,16 V21 H16 M8,21 H3 V16 M8,10 L10,8 H14 L16,10 V14 L14,16 H10 L8,14 Z")
    val VisibilityOff = outline("Privacy", "M3,3 L21,21 M9,5 C14,3 19,7 22,12 L19,16 M16,19 C11,23 5,18 2,12 L5,8 M10,10 A3,3 0,0 0,14,14")
}
