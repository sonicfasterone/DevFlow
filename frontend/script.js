document.addEventListener('DOMContentLoaded', () => {
    // Элементы интерфейса
    const refreshBtn = document.getElementById('refresh-btn');
    const tasksTable = document.getElementById('tasks-table').querySelector('tbody');
    const predictionsContainer = document.getElementById('predictions-container');
    const modal = document.getElementById('modal');
    const closeModal = document.querySelector('.close');
    
    // Инициализация графиков
    let leadTimeChart, tasksChart, bugsChart, stagesChart, forecastChart;
    
    // Загрузка данных
    function loadData() {
      fetch('http://localhost:3001/api/metrics')
        .then(response => response.json())
        .then(data => updateMetrics(data));
        
      fetch('http://localhost:3001/api/tasks')
        .then(response => response.json())
        .then(data => {
          updateTasksTable(data);
          generatePredictions(data);
        });
    }
    
    // Обновление метрик
    function updateMetrics(data) {
      document.getElementById('leadTimeValue').textContent = data.avgLeadTime;
      document.getElementById('completedTasksValue').textContent = data.completedTasks;
      document.getElementById('bugsValue').textContent = data.bugs;
      
      // Обновление графиков
      updateCharts(data);
    }
    
    // Обновление таблицы задач
    function updateTasksTable(tasks) {
      tasksTable.innerHTML = '';
      
      tasks.forEach(task => {
        const row = document.createElement('tr');
        
        const statusClass = {
          'todo': 'todo',
          'in_progress': 'in_progress',
          'done': 'done'
        }[task.status];
        
        row.innerHTML = `
          <td>${task.id}</td>
          <td>${task.title}</td>
          <td><span class="status-badge ${statusClass}">${task.status}</span></td>
          <td>
            ${task.status !== 'done' ? `<button class="predict-btn" data-task-id="${task.id}">Прогноз</button>` : ''}
          </td>
        `;
        
        tasksTable.appendChild(row);
      });
      
      // Добавляем обработчики для кнопок прогноза
      document.querySelectorAll('.predict-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const taskId = parseInt(btn.getAttribute('data-task-id'));
          showPredictionModal(taskId);
        });
      });
    }
    
    // Генерация прогнозов
    function generatePredictions(tasks) {
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
      
      if (inProgressTasks.length === 0) {
        predictionsContainer.innerHTML = '<div class="prediction-item">Нет задач в работе для прогнозирования</div>';
        return;
      }
      
      predictionsContainer.innerHTML = '<div class="prediction-loading">Генерация прогнозов...</div>';
      
      // Получаем прогнозы для всех задач в работе
      const predictionPromises = inProgressTasks.map(task => {
        return fetch('http://localhost:3001/api/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: task.id }),
        }).then(response => response.json());
      });
      
      Promise.all(predictionPromises).then(predictions => {
        predictionsContainer.innerHTML = '';
        
        predictions.forEach((prediction, index) => {
          const task = inProgressTasks[index];
          const riskLevel = prediction.risk > 70 ? 'high-risk' : 
                          prediction.risk > 30 ? 'medium-risk' : 'low-risk';
          
          const predictionElement = document.createElement('div');
          predictionElement.className = `prediction-item ${riskLevel}`;
          predictionElement.innerHTML = `
            <div>
              <strong>${task.title}</strong><br>
              <span>Прогноз: ${prediction.predictedTime} дней (точность: ${prediction.confidence})</span>
            </div>
            <div class="risk-value">Риск: ${prediction.risk}%</div>
          `;
          
          predictionElement.addEventListener('click', () => {
            showPredictionModal(task.id);
          });
          
          predictionsContainer.appendChild(predictionElement);
        });
      });
    }
    
    // Показать модальное окно с прогнозом
    function showPredictionModal(taskId) {
      fetch('http://localhost:3001/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      })
      .then(response => response.json())
      .then(prediction => {
        const task = tasksTable.querySelector(`[data-task-id="${taskId}"]`)?.closest('tr');
        const taskTitle = task?.querySelector('td:nth-child(2)').textContent;
        
        document.getElementById('modal-title').textContent = `Прогноз по задаче: ${taskTitle || `#${taskId}`}`;
        
        const riskLevel = prediction.risk > 70 ? 'высокий' : 
                        prediction.risk > 30 ? 'средний' : 'низкий';
        
        let suggestionsHTML = '';
        if (prediction.suggestions.length > 0) {
          suggestionsHTML = `
            <h3>Рекомендации:</h3>
            <ul class="suggestion-list">
              ${prediction.suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
          `;
        }
        
        document.getElementById('modal-body').innerHTML = `
          <div>
            <p><strong>Прогнозируемое время выполнения:</strong> ${prediction.predictedTime} дней</p>
            <p><strong>Уровень риска:</strong> <span class="risk-value">${riskLevel} (${prediction.risk}%)</span></p>
            <p><strong>Точность прогноза:</strong> ${prediction.confidence}</p>
            ${suggestionsHTML}
          </div>
        `;
        
        modal.style.display = 'block';
      });
    }
    
    // Инициализация графиков
    function initCharts() {
      // Lead Time Chart
      leadTimeChart = new Chart(document.getElementById('leadTimeChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Дни',
            data: [],
            borderColor: '#36a2eb',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
      
      // Tasks Chart
      tasksChart = new Chart(document.getElementById('tasksChart'), {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'Задачи',
            data: [],
            backgroundColor: '#4bc0c0'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
      
      // Bugs Chart
      bugsChart = new Chart(document.getElementById('bugsChart'), {
        type: 'pie',
        data: {
          labels: ['Критические', 'Средние', 'Низкие'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['#ff6384', '#ff9f40', '#ffcd56']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
      
      // Stages Chart
      stagesChart = new Chart(document.getElementById('stagesChart'), {
        type: 'bar',
        data: {
          labels: ['Анализ', 'Разработка', 'Тестирование'],
          datasets: [{
            label: 'Дни',
            data: [0, 0, 0],
            backgroundColor: '#9966ff'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
      
      // Forecast Chart
      forecastChart = new Chart(document.getElementById('forecastChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'План',
              data: [],
              borderColor: '#36a2eb',
              backgroundColor: 'rgba(54, 162, 235, 0.1)',
              tension: 0.1,
              fill: true
            },
            {
              label: 'Прогноз',
              data: [],
              borderColor: '#ff6384',
              backgroundColor: 'rgba(255, 99, 132, 0.1)',
              borderDash: [5, 5],
              tension: 0.1,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
    
    // Обновление графиков
    function updateCharts(data) {
      // Lead Time
      leadTimeChart.data.labels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май'];
      leadTimeChart.data.datasets[0].data = [
        data.avgLeadTime * 0.9,
        data.avgLeadTime * 1.1,
        data.avgLeadTime,
        data.avgLeadTime * 0.95,
        data.avgLeadTime * 1.05
      ];
      leadTimeChart.update();
      
      // Completed Tasks
      tasksChart.data.labels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май'];
      tasksChart.data.datasets[0].data = [
        data.completedTasks * 0.8,
        data.completedTasks * 1.2,
        data.completedTasks,
        data.completedTasks * 0.9,
        data.completedTasks * 1.1
      ];
      tasksChart.update();
      
      // Bugs
      bugsChart.data.datasets[0].data = [
        Math.round(data.bugs * 0.4),
        Math.round(data.bugs * 0.3),
        Math.round(data.bugs * 0.3)
      ];
      bugsChart.update();
      
      // Stages
      stagesChart.data.datasets[0].data = [
        data.stages.analysis,
        data.stages.development,
        data.stages.testing
      ];
      stagesChart.update();
      
      // Forecast
      forecastChart.data.labels = ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'];
      forecastChart.data.datasets[0].data = [8, 12, 15, 20]; // План
      forecastChart.data.datasets[1].data = [7, 10, 14, 18]; // Прогноз
      forecastChart.update();
    }
    
    // Обработчики событий
    refreshBtn.addEventListener('click', loadData);
    closeModal.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Инициализация
    initCharts();
    loadData();
  });
