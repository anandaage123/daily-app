import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons } from '@expo/vector-icons';

type Priority = 'low' | 'med' | 'high';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
}

export default function TodosScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('med');
  
  // Reference for the input to manually blur/focus if needed
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_todos_v3');
      if (stored) setTodos(JSON.parse(stored));
    } catch (e) {}
  };

  const saveTodos = async (newTodos: Todo[]) => {
    setTodos(newTodos); 
    try {
      await AsyncStorage.setItem('@daily_todos_v3', JSON.stringify(newTodos));
    } catch (e) {}
  };

  const aAddTodo = () => {
    if (inputText.trim()) {
      const newTodo: Todo = { id: Date.now().toString(), text: inputText.trim(), completed: false, priority: selectedPriority };
      const updated = [newTodo, ...todos].sort((a,b) => {
         const pVal = {high: 3, med: 2, low: 1};
         return pVal[b.priority] - pVal[a.priority];
      });
      saveTodos(updated);
      setInputText('');
    }
  };

  const toggleTodo = (id: string) => {
    const newTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTodos(newTodos);
  };

  const deleteTodo = (id: string) => {
    saveTodos(todos.filter(t => t.id !== id));
  };

  const clearCompleted = () => {
    saveTodos(todos.filter(t => !t.completed));
  };

  const getPriorityColor = (p: Priority) => {
    if (p === 'high') return Colors.accent;
    if (p === 'med') return '#FFD700'; // Gold
    return Colors.secondary; // Green
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Tasks</Text>
        <TouchableOpacity onPress={clearCompleted} style={styles.sweepBtn}>
          <Ionicons name="sparkles-outline" size={18} color={Colors.background} style={{marginRight: 5}} />
          <Text style={{color: Colors.background, fontWeight: 'bold'}}>Sweep</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.addSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="What needs to be done?"
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={aAddTodo}
          />
          <TouchableOpacity style={styles.addButton} onPress={aAddTodo}>
            <Ionicons name="add" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.prioritySelector}>
           <Text style={{...Typography.caption, color: Colors.textSecondary, marginRight: 10}}>Priority:</Text>
           {(['low', 'med', 'high'] as Priority[]).map(p => (
             <TouchableOpacity key={p} onPress={() => setSelectedPriority(p)} style={[styles.pBadge, selectedPriority === p && {backgroundColor: getPriorityColor(p)}]}>
               <Text style={{color: selectedPriority === p ? Colors.background : Colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase'}}>{p}</Text>
             </TouchableOpacity>
           ))}
        </View>
      </View>

      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.todoItem, { borderLeftColor: item.completed ? Colors.border : getPriorityColor(item.priority), borderLeftWidth: 4 }]}>
            <TouchableOpacity style={styles.todoContent} onPress={() => toggleTodo(item.id)}>
              <View style={[styles.checkbox, item.completed && styles.checkboxCompleted]}>
                {item.completed && <Ionicons name="checkmark" size={16} color={Colors.text} />}
              </View>
              <Text style={[styles.todoText, item.completed && styles.todoTextCompleted]}>
                {item.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={{color: Colors.textMuted, textAlign: 'center', marginTop: 50}}>No tasks pending. You're all caught up!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  header: { ...Typography.header },
  sweepBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.textSecondary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  addSection: { backgroundColor: Colors.surface, padding: 15, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: Colors.surfaceHighlight },
  inputContainer: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  addButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 12, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  prioritySelector: { flexDirection: 'row', alignItems: 'center' },
  pBadge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, marginHorizontal: 5, borderWidth: 1, borderColor: Colors.border },
  todoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 15, borderRadius: 12, marginBottom: 10, borderRightWidth: 1, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  todoContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.primary, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  checkboxCompleted: { backgroundColor: Colors.border, borderColor: Colors.border },
  todoText: { ...Typography.body, flex: 1 },
  todoTextCompleted: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  deleteButton: { padding: 5 }
});
