"""
Monitoring and alerting system for The Senate governance engine.

HARDENING REQUIREMENT 7: Observability & Monitoring
Tracks and alerts on:
- Senate execution time
- Judge invocation frequency
- Abstention rate
- Variance rate
- Protected flag frequency
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from utils.logging import get_logger

logger = get_logger("monitoring")


@dataclass
class AlertThreshold:
    """Alert threshold configuration."""
    alert_type: str
    threshold_value: float
    enabled: bool
    description: str


@dataclass
class Alert:
    """Alert instance."""
    alert_type: str
    severity: str  # 'warning', 'critical'
    message: str
    current_value: float
    threshold_value: float
    timestamp: datetime


class SenateMonitor:
    """
    Monitoring system for Senate governance operations.
    
    HARDENING REQUIREMENT 7: Tracks key metrics and generates alerts
    when thresholds are exceeded.
    """
    
    def __init__(self, supabase_audit_logger=None):
        """
        Initialize Senate monitor.
        
        Args:
            supabase_audit_logger: Supabase audit logger for metrics queries
        """
        self.audit_logger = supabase_audit_logger
        self.alert_thresholds = self._load_default_thresholds()
        self.active_alerts: List[Alert] = []
        logger.info("Senate monitor initialized")
    
    def _load_default_thresholds(self) -> Dict[str, AlertThreshold]:
        """Load default alert thresholds."""
        return {
            'judge_invocation_rate': AlertThreshold(
                alert_type='judge_invocation_rate',
                threshold_value=0.3,  # 30%
                enabled=True,
                description='Alert if judge invocation rate exceeds 30%'
            ),
            'abstention_rate': AlertThreshold(
                alert_type='abstention_rate',
                threshold_value=0.4,  # 40%
                enabled=True,
                description='Alert if abstention rate exceeds 40%'
            ),
            'variance_rate': AlertThreshold(
                alert_type='variance_rate',
                threshold_value=0.5,  # 50%
                enabled=True,
                description='Alert if vote variance exceeds 50%'
            ),
            'execution_time_ms': AlertThreshold(
                alert_type='execution_time_ms',
                threshold_value=5000,  # 5 seconds
                enabled=True,
                description='Alert if execution time exceeds 5 seconds'
            ),
            'protected_flag_rate': AlertThreshold(
                alert_type='protected_flag_rate',
                threshold_value=0.1,  # 10%
                enabled=True,
                description='Alert if protected flags exceed 10%'
            )
        }
    
    async def check_metrics(self, time_window_minutes: int = 60) -> List[Alert]:
        """
        Check all metrics and generate alerts if thresholds exceeded.
        
        Args:
            time_window_minutes: Time window for metric calculation
            
        Returns:
            List of active alerts
        """
        logger.debug(f"Checking metrics for {time_window_minutes} minute window")
        
        alerts = []
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=time_window_minutes)
        
        # Get metrics from audit logger
        if self.audit_logger:
            metrics = await self.audit_logger.get_metrics_summary(start_time, end_time)
            
            # Check each threshold
            alerts.extend(await self._check_judge_invocation_rate(metrics))
            alerts.extend(await self._check_abstention_rate(metrics))
            alerts.extend(await self._check_variance_rate(metrics))
            alerts.extend(await self._check_execution_time(metrics))
            alerts.extend(await self._check_protected_flag_rate(metrics))
        
        # Update active alerts
        self.active_alerts = alerts
        
        if alerts:
            logger.warning(f"Generated {len(alerts)} alerts")
            for alert in alerts:
                logger.warning(f"ALERT [{alert.severity}] {alert.alert_type}: {alert.message}")
        
        return alerts
    
    async def _check_judge_invocation_rate(self, metrics: Dict[str, Any]) -> List[Alert]:
        """Check judge invocation rate against threshold."""
        threshold = self.alert_thresholds['judge_invocation_rate']
        if not threshold.enabled:
            return []
        
        total_decisions = metrics.get('total_decisions', 0)
        if total_decisions == 0:
            return []
        
        judge_invocations = metrics.get('judge_invocations', 0)
        rate = judge_invocations / total_decisions
        
        if rate > threshold.threshold_value:
            return [Alert(
                alert_type='judge_invocation_rate',
                severity='warning' if rate < threshold.threshold_value * 1.5 else 'critical',
                message=f"Judge invocation rate {rate:.1%} exceeds threshold {threshold.threshold_value:.1%}",
                current_value=rate,
                threshold_value=threshold.threshold_value,
                timestamp=datetime.utcnow()
            )]
        
        return []
    
    async def _check_abstention_rate(self, metrics: Dict[str, Any]) -> List[Alert]:
        """Check abstention rate against threshold."""
        threshold = self.alert_thresholds['abstention_rate']
        if not threshold.enabled:
            return []
        
        avg_abstentions = metrics.get('avg_abstentions', 0)
        # Assuming 3 senators (would need to get from config)
        rate = avg_abstentions / 3.0 if avg_abstentions else 0
        
        if rate > threshold.threshold_value:
            return [Alert(
                alert_type='abstention_rate',
                severity='warning' if rate < threshold.threshold_value * 1.5 else 'critical',
                message=f"Abstention rate {rate:.1%} exceeds threshold {threshold.threshold_value:.1%}",
                current_value=rate,
                threshold_value=threshold.threshold_value,
                timestamp=datetime.utcnow()
            )]
        
        return []
    
    async def _check_variance_rate(self, metrics: Dict[str, Any]) -> List[Alert]:
        """Check vote variance rate against threshold."""
        threshold = self.alert_thresholds['variance_rate']
        if not threshold.enabled:
            return []
        
        # Would need to query variance metrics from execution_metrics table
        # Placeholder implementation
        return []
    
    async def _check_execution_time(self, metrics: Dict[str, Any]) -> List[Alert]:
        """Check execution time against threshold."""
        threshold = self.alert_thresholds['execution_time_ms']
        if not threshold.enabled:
            return []
        
        # Would need to query execution time metrics
        # Placeholder implementation
        return []
    
    async def _check_protected_flag_rate(self, metrics: Dict[str, Any]) -> List[Alert]:
        """Check protected flag rate against threshold."""
        threshold = self.alert_thresholds['protected_flag_rate']
        if not threshold.enabled:
            return []
        
        # Would need to query protected flag frequency
        # Placeholder implementation
        return []
    
    def get_active_alerts(self) -> List[Alert]:
        """Get list of currently active alerts."""
        return self.active_alerts
    
    def get_metrics_dashboard(self) -> Dict[str, Any]:
        """
        Get metrics dashboard data.
        
        Returns:
            Dict with dashboard metrics
        """
        return {
            "active_alerts": len(self.active_alerts),
            "alert_breakdown": {
                "warning": sum(1 for a in self.active_alerts if a.severity == 'warning'),
                "critical": sum(1 for a in self.active_alerts if a.severity == 'critical')
            },
            "thresholds": {
                name: {
                    "threshold": t.threshold_value,
                    "enabled": t.enabled,
                    "description": t.description
                }
                for name, t in self.alert_thresholds.items()
            },
            "timestamp": datetime.utcnow().isoformat()
        }


class MetricsCollector:
    """
    Collects and aggregates metrics for monitoring.
    
    Tracks real-time metrics during Senate execution.
    """
    
    def __init__(self):
        """Initialize metrics collector."""
        self.execution_times: List[int] = []
        self.judge_invocations: int = 0
        self.total_decisions: int = 0
        self.abstention_counts: List[int] = []
        self.variance_scores: List[float] = []
        self.protected_flag_counts: int = 0
    
    def record_execution(
        self,
        execution_time_ms: int,
        judge_invoked: bool,
        abstention_count: int,
        vote_variance: float,
        has_protected_flags: bool
    ) -> None:
        """
        Record metrics from a single execution.
        
        Args:
            execution_time_ms: Execution time in milliseconds
            judge_invoked: Whether Judge was invoked
            abstention_count: Number of abstentions
            vote_variance: Vote variance score
            has_protected_flags: Whether protected flags were present
        """
        self.execution_times.append(execution_time_ms)
        self.total_decisions += 1
        
        if judge_invoked:
            self.judge_invocations += 1
        
        self.abstention_counts.append(abstention_count)
        self.variance_scores.append(vote_variance)
        
        if has_protected_flags:
            self.protected_flag_counts += 1
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of collected metrics."""
        if not self.execution_times:
            return {"status": "no_data"}
        
        return {
            "total_decisions": self.total_decisions,
            "avg_execution_time_ms": sum(self.execution_times) / len(self.execution_times),
            "max_execution_time_ms": max(self.execution_times),
            "judge_invocation_rate": self.judge_invocations / self.total_decisions,
            "avg_abstention_count": sum(self.abstention_counts) / len(self.abstention_counts),
            "avg_variance": sum(self.variance_scores) / len(self.variance_scores),
            "protected_flag_rate": self.protected_flag_counts / self.total_decisions
        }
    
    def reset(self) -> None:
        """Reset all metrics."""
        self.execution_times.clear()
        self.judge_invocations = 0
        self.total_decisions = 0
        self.abstention_counts.clear()
        self.variance_scores.clear()
        self.protected_flag_counts = 0


class HealthChecker:
    """
    Health check system for Senate components.
    
    Monitors health of all governance components.
    """
    
    def __init__(self, orchestrator):
        """
        Initialize health checker.
        
        Args:
            orchestrator: Governance orchestrator instance
        """
        self.orchestrator = orchestrator
    
    async def check_health(self) -> Dict[str, Any]:
        """
        Perform comprehensive health check.
        
        Returns:
            Dict with health status
        """
        try:
            health = await self.orchestrator.health_check()
            
            # Determine overall status
            overall_status = "healthy"
            if health.get("status") == "degraded":
                overall_status = "degraded"
            elif health.get("status") == "unhealthy":
                overall_status = "unhealthy"
            
            return {
                "status": overall_status,
                "components": health.get("components", {}),
                "timestamp": datetime.utcnow().isoformat(),
                "issues": health.get("issues", [])
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
