import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

type Priority = 'low' | 'med' | 'high';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  isPrimary?: boolean;
}

export default function TodosScreen() {
  const { colors, isDark } = useTheme();
  const isFocused = useIsFocused();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('med');
  const [isAdding, setIsAdding] = useState(false);
  const [isClearModalVisible, setIsClearModalVisible] = useState(false);

  useEffect(() => {
    loadTodos();
  }, [isFocused]);

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_todos_v3');
      let loadedTodos: Todo[] = stored ? JSON.parse(stored) : [];
      const today = new Date().toDateString();
      const lastDate = await AsyncStorage.getItem('@todos_last_date');

      if (lastDate !== today) {
        loadedTodos = loadedTodos.map(t => ({ ...t, completed: false }));
        await AsyncStorage.setItem('@todos_last_date', today);
        await AsyncStorage.setItem('@daily_todos_v3', JSON.stringify(loadedTodos));
      }
      setTodos(loadedTodos);
    } catch (e) {}
  };

  const saveTodos = async (newTodos: Todo[]) => {
    setTodos(newTodos); 
    try {
      await AsyncStorage.setItem('@daily_todos_v3', JSON.stringify(newTodos));
    } catch (e) {}
  };

  const addTodo = () => {
    if (inputText.trim()) {
      const newTodo: Todo = {
        id: Date.now().toString(),
        text: inputText.trim(),
        completed: false,
        priority: selectedPriority,
        isPrimary: todos.length === 0
      };
      const updated = [newTodo, ...todos].sort((a, b) => {
        const pVal = { high: 3, med: 2, low: 1 };
        return pVal[b.priority] - pVal[a.priority];
      });
      saveTodos(updated);
      setInputText('');
      setIsAdding(false);
    }
  };

  const toggleTodo = (id: string) => {
    const newTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTodos(newTodos);
  };

  const deleteTodo = (id: string) => {
      saveTodos(todos.filter(t => t.id !== id));
  };

  const confirmClear = () => {
    saveTodos([]);
    setIsClearModalVisible(false);
  };

  const getPriorityColor = (p: Priority) => {
    if (p === 'high') return colors.error;
    if (p === 'med') return colors.secondary || '#765600';
    return colors.tertiary;
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    header: { marginBottom: 32 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    dateText: { ...Typography.caption, color: colors.textVariant, fontWeight: '800', letterSpacing: 1 },
    title: { ...Typography.header, fontSize: 32, color: colors.text },
    
    sweepBtn: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      ...Shadows.soft,
    },

    progressCard: {
      padding: 24,
      borderRadius: 28,
      backgroundColor: colors.surface,
      ...Shadows.soft,
      marginBottom: 32,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    progressLabel: { ...Typography.caption, fontWeight: '800', color: colors.textVariant },
    progressPercent: { ...Typography.title, fontSize: 18, color: colors.primary },
    progressBarBg: { height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },

    sectionTitle: { ...Typography.title, fontSize: 20, color: colors.text, marginBottom: 16 },

    todoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 22,
      marginBottom: 12,
      ...Shadows.soft,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary + '30',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    todoInfo: { flex: 1 },
    todoText: { ...Typography.body, fontWeight: '600', color: colors.text },
    todoTextDone: { textDecorationLine: 'line-through', color: colors.textVariant, opacity: 0.7 },
    
    priorityTag: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    priorityDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    priorityLabel: { ...Typography.caption, fontSize: 10, fontWeight: '800', color: colors.textVariant },

    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 24,
      ...Shadows.soft,
      overflow: 'hidden',
    },
    fabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,14,23,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      padding: 32,
      paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    },
    sheetTitle: { ...Typography.header, fontSize: 24, color: colors.text, marginBottom: 24 },
    input: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      ...Typography.body,
      color: colors.text,
      marginBottom: 24,
    },
    label: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, marginBottom: 12, letterSpacing: 1 },
    priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
    priorityBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.background,
      alignItems: 'center',
    },
    priorityBtnActive: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary,
    },
    priorityBtnText: { ...Typography.caption, fontWeight: '800', color: colors.textVariant },
    priorityBtnTextActive: { color: colors.primary },

    submitBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 18,
      alignItems: 'center',
      ...Shadows.soft,
    },
    submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 17 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { ...Typography.body, color: colors.textVariant, marginTop: 16, textAlign: 'center' },

    clearCard: {
      backgroundColor: colors.surface,
      margin: 24,
      padding: 32,
      borderRadius: 32,
      alignItems: 'center',
    },
    clearTitle: { ...Typography.header, fontSize: 22, color: colors.text, marginBottom: 12 },
    clearSub: { ...Typography.body, color: colors.textVariant, textAlign: 'center', marginBottom: 24 },
    clearActions: { flexDirection: 'row', gap: 12, width: '100%' },
    clearCancel: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center' },
    clearConfirm: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.error, alignItems: 'center' },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
                <Text style={styles.title}>Daily Tasks</Text>
              </View>
              <TouchableOpacity style={styles.sweepBtn} onPress={() => setIsClearModalVisible(true)}>
                <MaterialCommunityIcons name="broom" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>TODAY'S PROGRESS</Text>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Active Focus</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.todoCard}
            onPress={() => toggleTodo(item.id)}
            onLongPress={() => {
              Alert.alert('Delete Task', 'Remove this task?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTodo(item.id) }
              ]);
            }}
          >
            <View style={[styles.checkbox, item.completed && styles.checkboxActive]}>
              {item.completed && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </View>
            <View style={styles.todoInfo}>
              <Text style={[styles.todoText, item.completed && styles.todoTextDone]}>
                {item.text}
              </Text>
              <View style={styles.priorityTag}>
                <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                <Text style={styles.priorityLabel}>{item.priority.toUpperCase()}</Text>
              </View>
            </View>
            {item.isPrimary && !item.completed && (
               <Ionicons name="star" size={18} color={colors.secondary || '#765600'} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="notebook-outline" size={64} color={isDark ? colors.surfaceContainer : "#E0E0EF"} />
            <Text style={styles.emptyText}>The day is quiet.{"\n"}Add a task to begin.</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setIsAdding(true)}>
        <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>New Task</Text>
                <TouchableOpacity onPress={() => setIsAdding(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textVariant}
                value={inputText}
                onChangeText={setInputText}
                autoFocus
              />

              <Text style={styles.label}>PRIORITY</Text>
              <View style={styles.priorityRow}>
                {(['low', 'med', 'high'] as Priority[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setSelectedPriority(p)}
                    style={[styles.priorityBtn, selectedPriority === p && styles.priorityBtnActive]}
                  >
                    <Text style={[styles.priorityBtnText, selectedPriority === p && styles.priorityBtnTextActive]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addTodo}>
                <Text style={styles.submitBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Clear Modal */}
      <Modal visible={isClearModalVisible} transparent animationType="fade">
         <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
            <View style={styles.clearCard}>
               <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.error + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                  <MaterialCommunityIcons name="broom" size={32} color={colors.error} />
               </View>
               <Text style={styles.clearTitle}>Sweep All Tasks?</Text>
               <Text style={styles.clearSub}>This will permanently remove all tasks from your list for today.</Text>
               <View style={styles.clearActions}>
                  <TouchableOpacity style={styles.clearCancel} onPress={() => setIsClearModalVisible(false)}>
                     <Text style={[styles.submitBtnText, { color: colors.textVariant }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearConfirm} onPress={confirmClear}>
                     <Text style={styles.submitBtnText}>Sweep All</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </View>
  );
}
