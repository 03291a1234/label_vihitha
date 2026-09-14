import {
  Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, AfterViewInit
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div class="chart-host"><canvas #canvas></canvas></div>`,
  styles: [`.chart-host { position: relative; height: 100%; min-height: 240px; } canvas { max-height: 320px; }`]
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() config!: ChartConfiguration;
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() { this.render(); }

  ngOnChanges() { this.render(); }

  private render() {
    if (!this.canvas || !this.config) return;
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, this.config);
  }

  ngOnDestroy() { this.chart?.destroy(); }
}
