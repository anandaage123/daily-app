import React, { useState, useEffect, useRef } from 'react';
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
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const MM_Colors = {
  primary: '#4052B6',
  primaryLight: '#8899FF',
  background: '#F9F5FF',
  surface: '#FFFFFF',
  surfaceContainer: '#E9E5FF',
  text: '#2C2A51',
  textVariant: '#5A5781',
  secondary: '#765600',
  tertiary: '#006947',
  error: '#B41340',
  white: '#FFFFFF',
};

type Priority = 'low' | 'med' | 'high';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  isPrimary?: boolean;
}

export default function TodosScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('med');
  const [isAdding, setIsAdding] = useState(false);
  const [isClearModalVisible, setIsClearModalVisible] = useState(false);

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_todos_v3');
      let loadedTodos: Todo[] = stored ? JSON.parse(stored) : [];
      
      const lastDate = await AsyncStorage.getItem('@todos_last_date');
      const today = new Date().toDateString();
      
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
    if (p === 'high') return MM_Colors.error;
    if (p === 'med') return MM_Colors.secondary;
    return MM_Colors.tertiary;
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={styles.title}>Daily Tasks</Text>
        </View>
        <TouchableOpacity onPress={() => setIsClearModalVisible(true)} style={styles.iconButton}>
          <MaterialCommunityIcons name="broom" size={24} color={MM_Colors.primary} />
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={[MM_Colors.primary, MM_Colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.progressCard}
      >
        <View style={styles.progressInfo}>
          <View>
            <Text style={styles.progressTitle}>Focus Metrics</Text>
            <Text style={styles.progressSubtitle}>
              {totalCount === 0
                ? "No tasks set for today"
                : `${completedCount} OF ${totalCount} DONE`}
            </Text>
          </View>
          <MaterialCommunityIcons name="chart-donut" size={40} color={MM_Colors.white} opacity={0.6} />
        </View>
        
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={styles.progressQuote}>
          {progress === 1 ? "Perfect rhythm! You've mastered today." : "Your focus today is sharp. Keep the flow."}
        </Text>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Current Tasks</Text>
        <Text style={styles.sectionSubtitle}>{todos.length - completedCount} awaiting your rhythm</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.taskCard, item.completed && styles.taskCardCompleted]}
            onPress={() => toggleTodo(item.id)}
          >
            <View style={styles.taskMain}>
              <View style={[styles.checkbox, item.completed && { backgroundColor: MM_Colors.primary, borderColor: MM_Colors.primary }]}>
                {item.completed && <Ionicons name="checkmark" size={18} color={MM_Colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.taskHeaderRow}>
                  <Text style={[styles.taskText, item.completed && styles.taskTextCompleted]}>
                    {item.text}
                  </Text>
                  {item.isPrimary && !item.completed && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>FOCUS</Text>
                    </View>
                  )}
                </View>
                <View style={styles.taskFooter}>
                  <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                  <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.deleteBtn}>
              <Ionicons name="close" size={20} color={MM_Colors.textVariant} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="notebook-outline" size={64} color={MM_Colors.surfaceContainer} />
            <Text style={styles.emptyText}>The Muse is quiet. Add a task to begin.</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      <Modal visible={isClearModalVisible} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.clearModalContent}>
               <View style={styles.warningIconContainer}>
                  <MaterialCommunityIcons name="broom" size={40} color={MM_Colors.primary} />
               </View>
               <Text style={styles.clearTitle}>Sweep All Tasks?</Text>
               <Text style={styles.clearSub}>This will permanently remove all rituals from your daily list.</Text>
               <View style={styles.clearActions}>
                  <TouchableOpacity style={styles.clearCancelBtn} onPress={() => setIsClearModalVisible(false)}>
                     <Text style={styles.clearCancelText}>NOT YET</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearConfirmBtn} onPress={confirmClear}>
                     <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.clearGradient}>
                        <Text style={styles.clearConfirmText}>SWEEP ALL</Text>
                     </LinearGradient>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {!isAdding ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsAdding(true)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[MM_Colors.primary, MM_Colors.primaryLight]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={32} color={MM_Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.addOverlay}
        >
          <View style={styles.addSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Ionicons name="close-circle" size={28} color={MM_Colors.textVariant} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What needs to be done?"
              placeholderTextColor={MM_Colors.textVariant}
              value={inputText}
              onChangeText={setInputText}
              autoFocus
              onSubmitEditing={addTodo}
            />

            <View style={styles.priorityRow}>
              <Text style={styles.label}>PRIORITY</Text>
              <View style={styles.priorityOptions}>
                {(['low', 'med', 'high'] as Priority[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setSelectedPriority(p)}
                    style={[
                      styles.pOption,
                      selectedPriority === p && { backgroundColor: getPriorityColor(p), borderColor: getPriorityColor(p) }
                    ]}
                  >
                    <Text style={[styles.pOptionText, selectedPriority === p && { color: MM_Colors.white }]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={addTodo}>
              <Text style={styles.submitBtnText}>Add to Daily Rituals</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MM_Colors.background },
  listContent: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  headerContent: { marginBottom: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateText: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant, letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: '800', color: MM_Colors.text, letterSpacing: -0.5 },
  iconButton: { padding: 8, backgroundColor: MM_Colors.white, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },

  progressCard: { padding: 24, borderRadius: 32, marginBottom: 32, elevation: 4, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  progressTitle: { fontSize: 20, fontWeight: '700', color: MM_Colors.white },
  progressSubtitle: { fontSize: 12, fontWeight: '800', color: MM_Colors.white, opacity: 0.8, marginTop: 4, letterSpacing: 1 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 16 },
  progressBarFill: { height: 8, backgroundColor: MM_Colors.white, borderRadius: 4 },
  progressQuote: { fontSize: 14, color: MM_Colors.white, fontWeight: '500', fontStyle: 'italic', opacity: 0.9 },

  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: MM_Colors.text },
  sectionSubtitle: { fontSize: 14, color: MM_Colors.textVariant, marginTop: 2 },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MM_Colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#2C2A51',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2
  },
  taskCardCompleted: { opacity: 0.6 },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: MM_Colors.surfaceContainer, marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  taskHeaderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  taskText: { fontSize: 17, fontWeight: '600', color: MM_Colors.text, lineHeight: 22 },
  taskTextCompleted: { textDecorationLine: 'line-through', color: MM_Colors.textVariant },
  primaryBadge: { backgroundColor: MM_Colors.surfaceContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  primaryBadgeText: { fontSize: 10, fontWeight: '800', color: MM_Colors.primary },
  taskFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  priorityDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  priorityText: { fontSize: 10, fontWeight: '700', color: MM_Colors.textVariant, letterSpacing: 0.5 },
  deleteBtn: { padding: 4 },

  emptyState: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  emptyText: { marginTop: 16, fontSize: 16, color: MM_Colors.textVariant, textAlign: 'center' },

  fab: { position: 'absolute', right: 24, bottom: 40, borderRadius: 24, elevation: 8, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  fabGradient: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  addOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44, 42, 81, 0.4)', justifyContent: 'flex-end' },
  addSheet: { backgroundColor: MM_Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, paddingBottom: Platform.OS === 'ios' ? 48 : 32 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.text },
  input: { fontSize: 18, color: MM_Colors.text, fontWeight: '500', borderBottomWidth: 1, borderBottomColor: MM_Colors.surfaceContainer, paddingVertical: 12, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '800', color: MM_Colors.textVariant, letterSpacing: 1, marginBottom: 12 },
  priorityRow: { marginBottom: 32 },
  priorityOptions: { flexDirection: 'row', gap: 10 },
  pOption: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: MM_Colors.surfaceContainer, alignItems: 'center' },
  pOptionText: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant },
  submitBtn: { backgroundColor: MM_Colors.primary, paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  submitBtnText: { color: MM_Colors.white, fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  clearModalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 32, width: '100%', alignItems: 'center' },
  warningIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: MM_Colors.surfaceContainer, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  clearTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.text, marginBottom: 12 },
  clearSub: { fontSize: 16, color: MM_Colors.textVariant, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  clearActions: { flexDirection: 'row', gap: 12, width: '100%' },
  clearCancelBtn: { flex: 1, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: MM_Colors.background },
  clearCancelText: { fontWeight: '800', color: MM_Colors.textVariant, letterSpacing: 1 },
  clearConfirmBtn: { flex: 1.5, height: 60, borderRadius: 20, overflow: 'hidden' },
  clearGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  clearConfirmText: { fontWeight: '800', color: '#FFF', letterSpacing: 1 },
});
