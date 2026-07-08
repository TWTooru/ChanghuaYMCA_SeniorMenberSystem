Private Sub UserForm_Initialize()
    Call LoadData
End Sub

Private Sub LoadData()
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long
    Dim searchTerm As String
    Dim idText As String
    Dim nameText As String
    
    ' 如果有 txtSearch 控制項，就取得搜尋字串
    On Error Resume Next
    searchTerm = UCase(txtSearch.Value)
    On Error GoTo 0
    
    Set ws = ThisWorkbook.Sheets("總表") ' 假設資料在第一張工作表
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    ListBox1.Clear
    If lastRow > 1 Then
        For i = 2 To lastRow
            idText = CStr(ws.Cells(i, 1).Value)
            nameText = CStr(ws.Cells(i, 3).Value)
            
            ' 如果沒有搜尋字串，或 ID/姓名 包含搜尋字串
            If searchTerm = "" Or InStr(1, UCase(idText), searchTerm) > 0 Or InStr(1, UCase(nameText), searchTerm) > 0 Then
                ListBox1.AddItem idText & " - " & nameText
            End If
        Next i
    End If
End Sub

Private Sub txtSearch_Change()
    Call LoadData
End Sub

Private Sub ListBox1_Click()
    Dim ws As Worksheet
    Dim selectedRow As Long
    Dim originalId As String
    Dim lastRow As Long
    Dim i As Long
    
    If ListBox1.ListIndex <> -1 Then
        Set ws = ThisWorkbook.Sheets("總表")
        originalId = Split(ListBox1.List(ListBox1.ListIndex), " - ")(0)
        
        lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
        selectedRow = 0
        For i = 2 To lastRow
            If CStr(ws.Cells(i, 1).Value) = originalId Then
                selectedRow = i
                Exit For
            End If
        Next i
        
        If selectedRow > 0 Then
            ' 將資料帶入文字框
            txtId.Value = ws.Cells(selectedRow, 1).Value
            txtName.Value = ws.Cells(selectedRow, 3).Value
            txtPhone.Value = ws.Cells(selectedRow, 10).Value ' 假設 J 欄是手機
            txtNote.Value = ws.Cells(selectedRow, 15).Value  ' 假設 O 欄是備註
        End If
    End If
End Sub

Private Sub btnClear_Click()
    txtId.Value = ""
    txtName.Value = ""
    txtPhone.Value = ""
    txtNote.Value = ""
    ListBox1.ListIndex = -1
End Sub

Private Sub btnAdd_Click()
    Dim ws As Worksheet
    Dim emptyRow As Long
    Dim lastRow As Long
    Dim i As Long
    
    If txtId.Value = "" Then
        MsgBox "學號不能為空！", vbExclamation
        Exit Sub
    End If
    
    If txtName.Value = "" Then
        MsgBox "姓名不能為空！", vbExclamation
        Exit Sub
    End If
    
    Set ws = ThisWorkbook.Sheets("總表")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    For i = 2 To lastRow
        If CStr(ws.Cells(i, 1).Value) = txtId.Value Then
            MsgBox "學號已存在！", vbExclamation
            Exit Sub
        End If
    Next i
    
    emptyRow = lastRow + 1
    
    ws.Cells(emptyRow, 1).Value = txtId.Value
    ws.Cells(emptyRow, 3).Value = txtName.Value
    ws.Cells(emptyRow, 10).Value = txtPhone.Value
    ws.Cells(emptyRow, 15).Value = txtNote.Value
    
    MsgBox "新增成功！", vbInformation
    Call LoadData
    Call btnClear_Click
End Sub

Private Sub btnUpdate_Click()
    Dim ws As Worksheet
    Dim selectedRow As Long
    Dim originalId As String
    Dim lastRow As Long
    Dim i As Long
    
    If ListBox1.ListIndex = -1 Then
        MsgBox "請先從列表中選擇要修改的學員！", vbExclamation
        Exit Sub
    End If
    
    If txtId.Value = "" Then
        MsgBox "學號不能為空！", vbExclamation
        Exit Sub
    End If
    
    If txtName.Value = "" Then
        MsgBox "姓名不能為空！", vbExclamation
        Exit Sub
    End If
    
    Set ws = ThisWorkbook.Sheets("總表")
    originalId = Split(ListBox1.List(ListBox1.ListIndex), " - ")(0)
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    selectedRow = 0
    For i = 2 To lastRow
        If CStr(ws.Cells(i, 1).Value) = originalId Then
            selectedRow = i
            Exit For
        End If
    Next i
    
    If selectedRow > 0 Then
        ' 檢查更新後的學號是否與其他學員重複
        If txtId.Value <> originalId Then
            For i = 2 To lastRow
                If CStr(ws.Cells(i, 1).Value) = txtId.Value Then
                    MsgBox "學號已存在！", vbExclamation
                    Exit Sub
                End If
            Next i
        End If
        
        ws.Cells(selectedRow, 1).Value = txtId.Value
        ws.Cells(selectedRow, 3).Value = txtName.Value
        ws.Cells(selectedRow, 10).Value = txtPhone.Value
        ws.Cells(selectedRow, 15).Value = txtNote.Value
        
        MsgBox "更新成功！", vbInformation
        Call LoadData
        Call btnClear_Click
    Else
        MsgBox "找不到該筆資料！", vbExclamation
    End If
End Sub

Private Sub btnDelete_Click()
    Dim ws As Worksheet
    Dim selectedRow As Long
    Dim confirmMsg As Integer
    Dim originalId As String
    Dim lastRow As Long
    Dim i As Long
    
    If ListBox1.ListIndex = -1 Then
        MsgBox "請先從列表中選擇要刪除的學員！", vbExclamation
        Exit Sub
    End If
    
    confirmMsg = MsgBox("確定要刪除這位學員嗎？刪除後無法復原。", vbYesNo + vbCritical, "確認刪除")
    
    If confirmMsg = vbYes Then
        Set ws = ThisWorkbook.Sheets("總表")
        originalId = Split(ListBox1.List(ListBox1.ListIndex), " - ")(0)
        lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
        
        selectedRow = 0
        For i = 2 To lastRow
            If CStr(ws.Cells(i, 1).Value) = originalId Then
                selectedRow = i
                Exit For
            End If
        Next i
        
        If selectedRow > 0 Then
            ws.Rows(selectedRow).Delete
            
            MsgBox "刪除成功！", vbInformation
            Call LoadData
            Call btnClear_Click
        Else
            MsgBox "找不到該筆資料！", vbExclamation
        End If
    End If
End Sub
