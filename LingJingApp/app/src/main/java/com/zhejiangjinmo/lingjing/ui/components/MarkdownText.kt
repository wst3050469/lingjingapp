package com.zhejiangjinmo.lingjing.ui.components

import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import io.noties.markwon.Markwon

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    textColor: Color = Color(0xFFC9D1D9),
    textSize: Float = 15f
) {
    val context = LocalContext.current
    val markwon = remember { Markwon.create(context) }
    val colorArgb = textColor.toArgb()
    val size = textSize

    AndroidView(
        factory = { ctx ->
            TextView(ctx).apply {
                setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, size)
                setTextColor(colorArgb)
                movementMethod = LinkMovementMethod.getInstance()
                setLineSpacing(4f, 1.1f)
                setPadding(0, 4, 0, 4)
            }
        },
        update = { textView ->
            markwon.setMarkdown(textView, markdown)
        },
        modifier = modifier
    )
}
